import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { LLMProvider } from '../llm/provider.js';
import type { ToolContext } from '../tools/types.js';
import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ContextManager } from './context-manager.js';
import { buildSystemPrompt, buildToolResultMessage } from './message-builder.js';
import { logger } from '../utils/logger.js';

export interface AgentLoopConfig {
  provider: LLMProvider;
  toolRegistry: ToolRegistry;
  toolContext: ToolContext;
  cwd: string;
  model: string;
  projectMemory?: string;
  customInstructions?: string;
  maxTurns?: number;
  onContent?: (content: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: { success: boolean; output: string }) => void;
  onTurnComplete?: (turn: number) => void;
  onCompaction?: () => void;
}

export interface AgentLoopResult {
  finalContent: string;
  turns: number;
  totalTokens: number;
  aborted: boolean;
}

export class AgentLoop {
  private config: AgentLoopConfig;
  private contextManager: ContextManager;
  private toolExecutor: ToolExecutor;
  private aborted = false;
  private totalTokens = 0;

  constructor(config: AgentLoopConfig) {
    this.config = config;
    this.contextManager = new ContextManager(config.model);
    this.toolExecutor = new ToolExecutor(config.toolRegistry, config.toolContext);

    // Add system prompt
    const systemMsg = buildSystemPrompt({
      cwd: config.cwd,
      projectMemory: config.projectMemory,
      customInstructions: config.customInstructions,
    });
    this.contextManager.addMessage(systemMsg);
  }

  abort(): void {
    this.aborted = true;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  async run(userMessage: string): Promise<AgentLoopResult> {
    this.aborted = false;
    this.contextManager.addMessage({ role: 'user', content: userMessage });

    const maxTurns = this.config.maxTurns ?? 100;
    let turns = 0;
    let finalContent = '';

    while (turns < maxTurns && !this.aborted) {
      turns++;

      // Check if compaction is needed
      if (this.contextManager.needsCompaction()) {
        this.config.onCompaction?.();
        await this.contextManager.compact(this.config.provider);
      }

      const messages = this.contextManager.getMessages();
      const tools = this.config.toolRegistry.toOpenAI();

      logger.agent('main', `Turn ${turns}: sending ${messages.length} messages, ${tools.length} tools`);

      try {
        const response = await this.config.provider.chat(messages, tools);

        if (response.usage) {
          this.totalTokens += response.usage.totalTokens;
        }

        // Handle content
        if (response.content) {
          finalContent = response.content;
          this.config.onContent?.(response.content);
        }

        // Handle tool calls
        if (response.toolCalls.length > 0) {
          // Add assistant message with tool calls
          const assistantMsg: ChatCompletionMessageParam = {
            role: 'assistant',
            content: response.content ?? null,
            tool_calls: response.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
          this.contextManager.addMessage(assistantMsg);

          // Execute all tool calls
          for (const tc of response.toolCalls) {
            if (this.aborted) break;

            this.config.onToolCall?.(tc.name, tc.arguments);
            const execResult = await this.toolExecutor.execute(tc);
            this.config.onToolResult?.(tc.name, execResult.result);

            const toolMsg = buildToolResultMessage(tc.id, execResult.result);
            this.contextManager.addMessage(toolMsg);
          }

          this.config.onTurnComplete?.(turns);
          continue; // Go to next turn
        }

        // No tool calls = assistant is done
        if (response.content) {
          this.contextManager.addMessage({ role: 'assistant', content: response.content });
        }
        this.config.onTurnComplete?.(turns);
        break;

      } catch (error) {
        logger.error('Agent loop error:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        finalContent = `Error: ${errMsg}`;
        break;
      }
    }

    if (turns >= maxTurns) {
      finalContent += '\n\n[Max turns reached]';
    }

    return {
      finalContent,
      turns,
      totalTokens: this.totalTokens,
      aborted: this.aborted,
    };
  }

  async runContinuation(): Promise<AgentLoopResult> {
    // Continue from current context without a new user message
    return this.runFromCurrentState();
  }

  private async runFromCurrentState(): Promise<AgentLoopResult> {
    const maxTurns = this.config.maxTurns ?? 100;
    let turns = 0;
    let finalContent = '';

    while (turns < maxTurns && !this.aborted) {
      turns++;

      if (this.contextManager.needsCompaction()) {
        this.config.onCompaction?.();
        await this.contextManager.compact(this.config.provider);
      }

      const messages = this.contextManager.getMessages();
      const tools = this.config.toolRegistry.toOpenAI();

      try {
        const response = await this.config.provider.chat(messages, tools);
        if (response.usage) this.totalTokens += response.usage.totalTokens;

        if (response.content) {
          finalContent = response.content;
          this.config.onContent?.(response.content);
        }

        if (response.toolCalls.length > 0) {
          const assistantMsg: ChatCompletionMessageParam = {
            role: 'assistant',
            content: response.content ?? null,
            tool_calls: response.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          };
          this.contextManager.addMessage(assistantMsg);

          for (const tc of response.toolCalls) {
            if (this.aborted) break;
            this.config.onToolCall?.(tc.name, tc.arguments);
            const execResult = await this.toolExecutor.execute(tc);
            this.config.onToolResult?.(tc.name, execResult.result);
            this.contextManager.addMessage(buildToolResultMessage(tc.id, execResult.result));
          }
          continue;
        }

        if (response.content) {
          this.contextManager.addMessage({ role: 'assistant', content: response.content });
        }
        break;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        finalContent = `Error: ${errMsg}`;
        break;
      }
    }

    return { finalContent, turns, totalTokens: this.totalTokens, aborted: this.aborted };
  }
}
