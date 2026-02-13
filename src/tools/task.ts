import { createToolDef } from './types.js';
import { AgentLoop } from '../core/agent-loop.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { PermissionManager } from '../permissions/permission-manager.js';
import { logger } from '../utils/logger.js';

// The Task tool allows the main agent to spawn subagents for delegated work.
// Each subagent runs in its own isolated context with its own agent loop.

export function createTaskTool(deps: {
  provider: import('../llm/provider.js').LLMProvider;
  toolRegistry: ToolRegistry;
  cwd: string;
  askUser: (question: string) => Promise<string>;
}) {
  return createToolDef(
    'Task',
    'Spawn a subagent to handle a delegated task. The subagent runs in isolated context and returns a summary. Use for research, verification, or parallel work.',
    {
      required: ['description'],
      properties: {
        description: { type: 'string', description: 'What the subagent should do' },
        prompt: { type: 'string', description: 'System prompt/role for the subagent' },
        model: { type: 'string', description: 'Model to use (default: same as current)' },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict subagent to these tools (default: all read-only tools)',
        },
        max_turns: { type: 'integer', description: 'Max turns for the subagent (default: 20)' },
      },
    },
    async (args, context) => {
      const description = args.description as string;
      const prompt = (args.prompt as string) ?? 'You are a helpful subagent. Complete the task and return a concise summary.';
      const model = (args.model as string) ?? undefined;
      const toolNames = (args.tools as string[]) ?? ['Read', 'Grep', 'Glob', 'ListDir', 'Bash'];
      const maxTurns = (args.max_turns as number) ?? 20;

      logger.agent('subagent', `Spawning for: ${description.slice(0, 100)}`);

      const subRegistry = deps.toolRegistry.subset(toolNames);
      const subPermissions = new PermissionManager('dontAsk');

      const subLoop = new AgentLoop({
        provider: deps.provider,
        toolRegistry: subRegistry,
        toolContext: {
          cwd: deps.cwd,
          permissions: subPermissions,
          askUser: deps.askUser,
        },
        cwd: deps.cwd,
        model: model ?? 'inherit',
        customInstructions: prompt,
        maxTurns,
      });

      try {
        const result = await subLoop.run(description);
        logger.agent('subagent', `Completed in ${result.turns} turns`);
        return {
          success: true,
          output: result.finalContent || '(subagent produced no output)',
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, output: '', error: `Subagent failed: ${msg}` };
      }
    },
  );
}
