import type { LLMProvider } from '../llm/provider.js';
import type { ToolRegistry } from '../core/tool-registry.js';
import { AgentLoop } from '../core/agent-loop.js';
import { PermissionManager, type PermissionMode } from '../permissions/permission-manager.js';
import { BUILTIN_SUBAGENTS, type SubagentConfig } from './subagent-config.js';
import { logger } from '../utils/logger.js';

export interface SubagentResult {
  name: string;
  output: string;
  turns: number;
  totalTokens: number;
  success: boolean;
  error?: string;
}

export class SubagentManager {
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private cwd: string;
  private askUser: (question: string) => Promise<string>;
  private customConfigs = new Map<string, SubagentConfig>();
  private runningAgents = new Map<string, AgentLoop>();

  constructor(opts: {
    provider: LLMProvider;
    toolRegistry: ToolRegistry;
    cwd: string;
    askUser: (question: string) => Promise<string>;
  }) {
    this.provider = opts.provider;
    this.toolRegistry = opts.toolRegistry;
    this.cwd = opts.cwd;
    this.askUser = opts.askUser;
  }

  registerConfig(config: SubagentConfig): void {
    this.customConfigs.set(config.name, config);
  }

  getConfig(name: string): SubagentConfig | undefined {
    return this.customConfigs.get(name) ?? BUILTIN_SUBAGENTS[name];
  }

  listAvailable(): SubagentConfig[] {
    const all = new Map<string, SubagentConfig>();
    for (const [name, config] of Object.entries(BUILTIN_SUBAGENTS)) {
      all.set(name, config);
    }
    for (const [name, config] of this.customConfigs) {
      all.set(name, config);
    }
    return Array.from(all.values());
  }

  async run(nameOrConfig: string | SubagentConfig, prompt: string, opts?: {
    onContent?: (content: string) => void;
    onToolCall?: (name: string, args: Record<string, unknown>) => void;
  }): Promise<SubagentResult> {
    const config = typeof nameOrConfig === 'string'
      ? this.getConfig(nameOrConfig)
      : nameOrConfig;

    if (!config) {
      return {
        name: typeof nameOrConfig === 'string' ? nameOrConfig : 'unknown',
        output: '',
        turns: 0,
        totalTokens: 0,
        success: false,
        error: `Subagent "${nameOrConfig}" not found. Available: ${this.listAvailable().map(c => c.name).join(', ')}`,
      };
    }

    logger.agent(config.name, `Starting subagent: ${prompt.slice(0, 80)}`);

    const toolNames = config.tools ?? ['Read', 'Grep', 'Glob', 'ListDir'];
    const subRegistry = this.toolRegistry.subset(toolNames);
    const permMode = (config.permissionMode ?? 'plan') as PermissionMode;
    const permManager = new PermissionManager(permMode);

    const agentLoop = new AgentLoop({
      provider: this.provider,
      toolRegistry: subRegistry,
      toolContext: {
        cwd: this.cwd,
        permissions: permManager,
        askUser: this.askUser,
      },
      cwd: this.cwd,
      model: config.model ?? 'inherit',
      customInstructions: config.systemPrompt,
      maxTurns: config.maxTurns ?? 20,
      onContent: opts?.onContent,
      onToolCall: opts?.onToolCall,
    });

    this.runningAgents.set(config.name, agentLoop);

    try {
      const result = await agentLoop.run(prompt);
      logger.agent(config.name, `Completed in ${result.turns} turns`);

      return {
        name: config.name,
        output: result.finalContent,
        turns: result.turns,
        totalTokens: result.totalTokens,
        success: !result.aborted,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Subagent ${config.name} failed:`, msg);
      return {
        name: config.name,
        output: '',
        turns: 0,
        totalTokens: 0,
        success: false,
        error: msg,
      };
    } finally {
      this.runningAgents.delete(config.name);
    }
  }

  abort(name: string): boolean {
    const loop = this.runningAgents.get(name);
    if (!loop) return false;
    loop.abort();
    return true;
  }

  abortAll(): void {
    for (const [, loop] of this.runningAgents) {
      loop.abort();
    }
  }

  isRunning(name: string): boolean {
    return this.runningAgents.has(name);
  }
}
