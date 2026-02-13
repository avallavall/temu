import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
  toOpenAI(): ChatCompletionTool;
}

export interface ToolContext {
  cwd: string;
  permissions: PermissionChecker;
  askUser: (question: string) => Promise<string>;
  abortSignal?: AbortSignal;
}

export interface PermissionChecker {
  check(toolName: string, args?: Record<string, unknown>): Promise<PermissionResult>;
  allowForSession(toolKey: string): void;
}

export type PermissionResult =
  | { allowed: true }
  | { allowed: false; reason: string }
  | { needsApproval: true; description: string };

export function createToolDef(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>,
): ToolDefinition {
  return {
    name,
    description,
    parameters,
    execute,
    toOpenAI(): ChatCompletionTool {
      return {
        type: 'function',
        function: {
          name,
          description,
          parameters: {
            type: 'object',
            ...parameters,
          },
        },
      };
    },
  };
}
