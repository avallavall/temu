export interface SubagentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  background?: boolean;
}

// Built-in subagent presets
export const BUILTIN_SUBAGENTS: Record<string, SubagentConfig> = {
  researcher: {
    name: 'researcher',
    description: 'Explores codebases and answers questions without making changes',
    systemPrompt: 'You are a code researcher. Explore the codebase to answer questions. Read files, search with grep/glob, and list directories. Do NOT make any changes. Provide concise, factual answers.',
    tools: ['Read', 'Grep', 'Glob', 'ListDir'],
    permissionMode: 'plan',
    maxTurns: 30,
  },
  reviewer: {
    name: 'reviewer',
    description: 'Reviews code for bugs, style issues, and improvements',
    systemPrompt: 'You are a code reviewer. Read the specified files and provide a thorough review covering: bugs, security issues, performance concerns, style inconsistencies, and suggested improvements. Be specific with line numbers.',
    tools: ['Read', 'Grep', 'Glob', 'ListDir'],
    permissionMode: 'plan',
    maxTurns: 20,
  },
  tester: {
    name: 'tester',
    description: 'Writes and runs tests for the codebase',
    systemPrompt: 'You are a test engineer. Write comprehensive tests for the specified code. Read existing code to understand the implementation, then write tests. Run the test suite after writing.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'ListDir'],
    permissionMode: 'dontAsk',
    maxTurns: 40,
  },
  fixer: {
    name: 'fixer',
    description: 'Fixes specific bugs or issues in the codebase',
    systemPrompt: 'You are a bug fixer. Diagnose and fix the specified issue. Read relevant code, identify the root cause, make minimal targeted fixes, and verify the fix works. Prefer single-line changes when sufficient.',
    tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'ListDir'],
    permissionMode: 'dontAsk',
    maxTurns: 30,
  },
  documenter: {
    name: 'documenter',
    description: 'Generates documentation for code',
    systemPrompt: 'You are a technical writer. Read the specified code and generate clear, concise documentation. Include: purpose, API reference, usage examples, and important notes.',
    tools: ['Read', 'Write', 'Grep', 'Glob', 'ListDir'],
    permissionMode: 'dontAsk',
    maxTurns: 20,
  },
};
