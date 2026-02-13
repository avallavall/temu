export type HookEvent =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'PreCompact'
  | 'SessionEnd';

export interface HookInput {
  event: HookEvent;
  sessionId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: { success: boolean; output: string; error?: string };
  teammateName?: string;
  taskId?: string;
  timestamp: number;
}

export interface HookOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// Exit code 0 = success, hook passes
// Exit code 1 = error, hook failed (logged but agent continues)
// Exit code 2 = feedback, send content back to agent (for TeammateIdle/TaskCompleted)
export const HOOK_EXIT_PASS = 0;
export const HOOK_EXIT_ERROR = 1;
export const HOOK_EXIT_FEEDBACK = 2;
