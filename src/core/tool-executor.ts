import type { ToolRegistry } from './tool-registry.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import type { LLMToolCall } from '../llm/provider.js';
import type { HookManager } from '../hooks/hook-manager.js';
import { logger } from '../utils/logger.js';

export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: ToolResult;
}

export class ToolExecutor {
  private hookManager?: HookManager;

  constructor(
    private registry: ToolRegistry,
    private context: ToolContext,
    hookManager?: HookManager,
  ) {
    this.hookManager = hookManager;
  }

  async execute(toolCall: LLMToolCall): Promise<ToolExecutionResult> {
    const tool = this.registry.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result: {
          success: false,
          output: '',
          error: `Unknown tool: ${toolCall.name}. Available tools: ${this.registry.names().join(', ')}`,
        },
      };
    }

    // Check permissions
    const permResult = await this.context.permissions.check(toolCall.name, toolCall.arguments);
    if ('allowed' in permResult && !permResult.allowed) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result: {
          success: false,
          output: '',
          error: `Permission denied for tool "${toolCall.name}": ${permResult.reason}`,
        },
      };
    }

    if ('needsApproval' in permResult && permResult.needsApproval) {
      const answer = await this.context.askUser(
        `Allow ${toolCall.name}? ${permResult.description} (y/n)`,
      );
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        return {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result: {
            success: false,
            output: '',
            error: `User denied permission for tool "${toolCall.name}"`,
          },
        };
      }
    }

    logger.tool(toolCall.name, 'Executing with args:', JSON.stringify(toolCall.arguments).slice(0, 200));

    // Fire PreToolUse hooks
    await this.hookManager?.fire({
      event: 'PreToolUse',
      toolName: toolCall.name,
      toolArgs: toolCall.arguments,
      timestamp: Date.now(),
    });

    try {
      const result = await tool.execute(toolCall.arguments, this.context);
      logger.tool(toolCall.name, `Result: success=${result.success}, output=${result.output.length} chars`);

      // Fire PostToolUse hooks
      const hookEvent = result.success ? 'PostToolUse' as const : 'PostToolUseFailure' as const;
      await this.hookManager?.fire({
        event: hookEvent,
        toolName: toolCall.name,
        toolArgs: toolCall.arguments,
        toolResult: result,
        timestamp: Date.now(),
      });

      return { toolCallId: toolCall.id, toolName: toolCall.name, result };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${toolCall.name} threw:`, errMsg);
      const result = { success: false, output: '', error: errMsg };

      await this.hookManager?.fire({
        event: 'PostToolUseFailure',
        toolName: toolCall.name,
        toolArgs: toolCall.arguments,
        toolResult: result,
        timestamp: Date.now(),
      });

      return { toolCallId: toolCall.id, toolName: toolCall.name, result };
    }
  }

  async executeAll(toolCalls: LLMToolCall[]): Promise<ToolExecutionResult[]> {
    // Execute tool calls sequentially to avoid file conflicts
    const results: ToolExecutionResult[] = [];
    for (const tc of toolCalls) {
      results.push(await this.execute(tc));
    }
    return results;
  }
}
