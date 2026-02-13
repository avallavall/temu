import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const SYSTEM_PROMPT_BASE = `You are TEMU, an expert agentic coding assistant running in the user's terminal.
You have access to tools to read files, edit files, search code, execute commands, and more.
You are working in the user's project directory.

Core behaviors:
- Read files before editing them to understand context
- Make minimal, focused edits - do not rewrite entire files unnecessarily
- Use Grep and Glob to explore the codebase before making changes
- Run tests after making changes when possible
- Ask the user for clarification when requirements are ambiguous
- Never execute destructive commands without explicit confirmation

When editing files:
- Use the Edit tool for single find-and-replace operations
- Use MultiEdit for multiple changes to the same file
- Use Write only for new files
- Preserve existing code style and conventions

When searching:
- Use Grep for content search (regex or literal)
- Use Glob for file name search
- Use ListDir for directory listing
- Use Read to view file contents`;

export function buildSystemPrompt(opts: {
  cwd: string;
  projectMemory?: string;
  customInstructions?: string;
}): ChatCompletionMessageParam {
  const parts = [SYSTEM_PROMPT_BASE];

  parts.push(`\nCurrent working directory: ${opts.cwd}`);
  parts.push(`Platform: ${process.platform}`);

  if (opts.projectMemory) {
    parts.push(`\n--- Project Memory (TEMU.md) ---\n${opts.projectMemory}\n--- End Project Memory ---`);
  }

  if (opts.customInstructions) {
    parts.push(`\n--- Custom Instructions ---\n${opts.customInstructions}\n--- End Custom Instructions ---`);
  }

  return { role: 'system', content: parts.join('\n') };
}

export function buildToolResultMessage(
  toolCallId: string,
  result: { success: boolean; output: string; error?: string },
): ChatCompletionMessageParam {
  const content = result.success
    ? result.output
    : `Error: ${result.error ?? 'Unknown error'}\n${result.output}`;

  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: content.slice(0, 50000), // Truncate very large outputs
  };
}

export function buildUserMessage(content: string): ChatCompletionMessageParam {
  return { role: 'user', content };
}
