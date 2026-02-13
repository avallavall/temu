// Public API barrel exports for using TEMU as a library

// LLM
export { OllamaProvider } from './llm/ollama-provider.js';
export type { LLMProvider, LLMResponse, LLMToolCall, LLMProviderConfig } from './llm/provider.js';
export { estimateTokens, estimateMessagesTokens, getModelConfig } from './llm/token-counter.js';
export type { ModelContextConfig } from './llm/token-counter.js';

// Core
export { AgentLoop } from './core/agent-loop.js';
export type { AgentLoopConfig, AgentLoopResult } from './core/agent-loop.js';
export { ContextManager } from './core/context-manager.js';
export { ToolRegistry } from './core/tool-registry.js';
export { ToolExecutor } from './core/tool-executor.js';
export { buildSystemPrompt, buildToolResultMessage } from './core/message-builder.js';

// Tools
export type { ToolDefinition, ToolResult, ToolContext } from './tools/types.js';
export { createToolDef } from './tools/types.js';
export { readTool } from './tools/read.js';
export { writeTool } from './tools/write.js';
export { editTool } from './tools/edit.js';
export { multiEditTool } from './tools/multi-edit.js';
export { bashTool } from './tools/bash.js';
export { grepTool } from './tools/grep.js';
export { globTool } from './tools/glob.js';
export { listDirTool } from './tools/list-dir.js';
export { askUserTool } from './tools/ask-user.js';
export { createTaskTool } from './tools/task.js';

// Teams
export { TeamManager } from './teams/team-manager.js';
export type { CreateTeamRequest, TeamManagerCallbacks } from './teams/team-manager.js';
export { Teammate } from './teams/teammate.js';
export type { TeammateStatus, TeammateCallbacks } from './teams/teammate.js';
export { TaskList } from './teams/task-list.js';
export type { TaskItem } from './teams/task-list.js';
export { MessageBus } from './teams/message-bus.js';
export type { TeamMessage, MessageType } from './teams/message-bus.js';
export { saveTeamConfig, loadTeamConfig, deleteTeamConfig } from './teams/team-config.js';
export type { TeamConfig, TeammateConfig } from './teams/team-config.js';

// Subagents
export { SubagentManager } from './subagents/subagent-manager.js';
export type { SubagentResult } from './subagents/subagent-manager.js';
export { BUILTIN_SUBAGENTS } from './subagents/subagent-config.js';
export type { SubagentConfig } from './subagents/subagent-config.js';

// Skills
export { loadAllSkills, skillToPrompt } from './skills/skill-loader.js';
export type { Skill } from './skills/skill-loader.js';

// Permissions
export { PermissionManager } from './permissions/permission-manager.js';
export type { PermissionMode } from './permissions/permission-manager.js';

// Hooks
export { HookManager } from './hooks/hook-manager.js';
export type { HookConfig } from './hooks/hook-manager.js';
export type { HookEvent, HookInput, HookOutput } from './hooks/hook-events.js';

// Sessions
export { SessionManager } from './sessions/session.js';
export type { SessionData } from './sessions/session.js';

// Config
export { TEMU_DIRS, ensureTemuDirs, ensureDir } from './config/paths.js';
export { loadSettings, saveUserSettings } from './config/settings.js';
export type { TemuSettings } from './config/settings.js';
export { loadMemoryChain } from './config/memory.js';

// Utils
export { logger, setLogLevel } from './utils/logger.js';
export { renderMarkdown } from './utils/markdown.js';
export { formatDiff } from './utils/diff.js';
