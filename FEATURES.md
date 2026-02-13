# Claude Code vs TEMU — Feature Comparison

Comprehensive checklist comparing Claude Code features with TEMU's implementation status.

## Core Agent

| Feature | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| Agent loop (reason → tool → result) | ✅ | ✅ | ✅ Complete |
| Multi-turn autonomous execution | ✅ | ✅ | ✅ Complete |
| Max turns limit | ✅ | ✅ | ✅ Complete |
| Abort/interrupt running agent | ✅ | ✅ | ✅ Complete |
| Streaming responses | ✅ | ✅ (provider ready, not used in loop) | ⚠️ Partial |
| Context auto-compaction | ✅ | ✅ | ✅ Complete |
| Token tracking | ✅ | ✅ | ✅ Complete |
| System prompt with project context | ✅ | ✅ | ✅ Complete |

## Tools

| Tool | Claude Code | TEMU | Status |
|------|------------|------|--------|
| Read (file with line numbers) | ✅ | ✅ | ✅ Complete |
| Write (create new files) | ✅ | ✅ | ✅ Complete |
| Edit (find-and-replace) | ✅ | ✅ | ✅ Complete |
| MultiEdit (atomic multi-edit) | ✅ | ✅ | ✅ Complete |
| Bash (shell commands) | ✅ | ✅ | ✅ Complete |
| Grep (ripgrep + fallback) | ✅ | ✅ | ✅ Complete |
| Glob (fd + fallback) | ✅ | ✅ | ✅ Complete |
| ListDir (directory listing) | ✅ | ✅ | ✅ Complete |
| AskUser (clarification) | ✅ | ✅ | ✅ Complete |
| Task (spawn subagent) | ✅ | ✅ | ✅ Complete |
| NotebookEdit (Jupyter) | ✅ | ❌ | 🔲 Not implemented |
| WebSearch/URLFetch (MCP) | Via MCP | ❌ | 🔲 Not implemented |

## CLI

| Feature | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| Interactive REPL | ✅ | ✅ | ✅ Complete |
| Print mode (`-p`) | ✅ | ✅ | ✅ Complete |
| `--model` flag | ✅ | ✅ | ✅ Complete |
| `--continue` (resume session) | ✅ | ✅ | ✅ Complete |
| `--verbose` flag | ✅ | ✅ | ✅ Complete |
| `--permission-mode` flag | ✅ | ✅ | ✅ Complete |
| `--max-turns` flag | ✅ | ✅ | ✅ Complete |
| `--ollama-url` (provider URL) | N/A | ✅ | ✅ Complete |
| Piped stdin input | ✅ | ✅ | ✅ Complete |
| `--output-format` (json, stream-json) | ✅ | ❌ | 🔲 Not implemented |
| `--add-dir` (multi-directory) | ✅ | ❌ | 🔲 Not implemented |
| `--allowedTools` filter | ✅ | ❌ | 🔲 Not implemented |

## Slash Commands

| Command | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| `/help` | ✅ | ✅ | ✅ Complete |
| `/exit` / `/quit` | ✅ | ✅ | ✅ Complete |
| `/clear` | ✅ | ✅ | ✅ Complete |
| `/model` | ✅ | ✅ | ✅ Complete |
| `/compact` | ✅ | ✅ | ✅ Complete |
| `/cost` (token usage) | ✅ | ✅ | ✅ Complete |
| `/plan` (read-only mode) | ✅ | ✅ | ✅ Complete |
| `/sessions` | ✅ | ✅ | ✅ Complete |
| `/agent` (subagents) | ✅ | ✅ | ✅ Complete |
| `/skills` | ✅ | ✅ | ✅ Complete |
| `/tasks` (team tasks) | ✅ | ✅ | ✅ Complete |
| `/team` (team status) | ✅ | ✅ | ✅ Complete |
| `/permissions` | ✅ | ❌ | 🔲 Not implemented |
| `/bug` (report) | ✅ | ❌ | 🔲 Not implemented |
| `/init` (project setup) | ✅ | ❌ | 🔲 Not implemented |
| `/review` | ✅ | ❌ | 🔲 Not implemented |
| `/doctor` (health check) | ✅ | ❌ | 🔲 Not implemented |

## Permissions

| Feature | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| Default mode (ask for writes) | ✅ | ✅ | ✅ Complete |
| Accept-edits mode | ✅ | ✅ | ✅ Complete |
| Plan/read-only mode | ✅ | ✅ | ✅ Complete |
| Bypass mode (allow all) | ✅ | ✅ | ✅ Complete |
| Don't-ask mode | ✅ | ✅ | ✅ Complete |
| Allow/deny rules with wildcards | ✅ | ✅ | ✅ Complete |
| Session-level allows | ✅ | ✅ | ✅ Complete |
| Tool-specific permission prompts | ✅ | ✅ | ✅ Complete |

## Configuration

| Feature | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| User settings (`~/.temu/settings.json`) | ✅ | ✅ | ✅ Complete |
| Project settings (`.temu/settings.json`) | ✅ | ✅ | ✅ Complete |
| Local settings (`.temu/settings.local.json`) | ✅ | ✅ | ✅ Complete |
| Layered merge (defaults < user < project < local) | ✅ | ✅ | ✅ Complete |
| Project memory (`TEMU.md` / `CLAUDE.md`) | ✅ | ✅ | ✅ Complete |
| Memory chain (walk up directories) | ✅ | ✅ | ✅ Complete |
| Environment variable overrides | ✅ | ❌ | 🔲 Not implemented |

## Advanced Features

| Feature | Claude Code | TEMU | Status |
|---------|------------|------|--------|
| Agent Teams (multi-agent) | ❌ | ✅ | ✅ TEMU exclusive |
| Shared TaskList + MessageBus | ❌ | ✅ | ✅ TEMU exclusive |
| Subagent Manager (5 built-ins) | ✅ | ✅ | ✅ Complete |
| Skills (SKILL.md workflows) | ✅ | ✅ | ✅ Complete |
| Hooks (lifecycle events) | ✅ | ✅ | ✅ Complete |
| Session persistence | ✅ | ✅ | ✅ Complete |
| Library API (barrel export) | ❌ | ✅ | ✅ TEMU exclusive |
| MCP (Model Context Protocol) | ✅ | ❌ | 🔲 Not implemented |
| OAuth/API key management | ✅ | N/A | N/A (local only) |
| Cloud provider support | ✅ | ❌ (Ollama only) | 🔲 By design |

## Testing

| Metric | Value |
|--------|-------|
| Test files | 36 |
| Total tests | 374 |
| Statement coverage | 60.8% |
| Function coverage | 93.3% |
| Branch coverage | 86.5% |
| Modules at 100% | 15/30+ |

## Summary

- **Implemented**: 45+ features matching Claude Code
- **TEMU exclusives**: Agent Teams, Library API, multi-agent orchestration
- **Not implemented**: 9 features (NotebookEdit, MCP, some CLI flags, some slash commands)
- **By design**: No cloud providers (Ollama-only for local privacy)
