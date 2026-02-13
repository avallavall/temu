# TEMU — Terminal Engine for Multi-agent Unification

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-374%20passing-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)]()

An open-source agentic coding assistant that runs entirely on local models via **Ollama**. No API keys. No cloud costs. All the power of an AI coding agent on your own hardware.

> **Claude Code clone, but 100% local and free.** Autonomous agent loop, 10 built-in tools, multi-agent teams, subagents, skills, hooks, and more.

## Features

- **Agent Loop** — Autonomous reasoning → tool call → result cycle, just like Claude Code
- **Built-in Tools** — Read, Write, Edit, Bash, Grep, Glob, ListDir, AskUser
- **Agent Teams** — Orchestrate multiple AI agents working in parallel on complex tasks
  - Shared task list with automatic self-claiming
  - Inter-agent messaging (message, broadcast)
  - In-process display mode with teammate navigation
- **Subagents** — Delegate tasks to specialized agents with restricted tools/models
- **Permissions** — Fine-grained allow/ask/deny rules per tool
- **Context Management** — Auto-compaction when approaching model limits
- **Session Persistence** — Resume previous conversations
- **Project Memory** — `TEMU.md` for persistent project context
- **Multi-model** — Use different models for different agents (e.g., small model for exploration, large for coding)

## Prerequisites

- **Node.js** >= 20
- **Ollama** running locally — https://ollama.com
- At least one model pulled: `ollama pull qwen3:8b`

## Quick Start

```bash
# Install dependencies
npm install

# Run in dev mode
npx tsx src/index.ts

# Or with a query
npx tsx src/index.ts "explain this project"

# Print mode (non-interactive)
npx tsx src/index.ts -p "list all TypeScript files"

# Pipe mode
cat error.log | npx tsx src/index.ts -p "explain these errors"

# Choose a model
npx tsx src/index.ts --model qwen3:32b
```

## Build & Install Globally

```bash
npm run build
npm link
temu "hello world"
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model [name]` | View or change model |
| `/clear` | Clear conversation context |
| `/compact` | Manually compact context |
| `/cost` | Show token usage |
| `/tasks` | Show team task list |
| `/team` | Show team status |
| `/teamview` | Split-pane style view of teammates and tasks |
| `/displaymode [mode]` | Set display mode: in-process or split-pane |
| `/sessions` | List previous sessions |
| `/agent [name] [prompt]` | Run a subagent |
| `/skills` | List loaded skills |
| `/plan` | Switch to plan (read-only) mode |
| `/exit` | Exit TEMU |

## Subagents

Run specialized agents with restricted tools and isolated context:

```
/agent researcher explain how the permission system works
/agent reviewer check src/core/agent-loop.ts for bugs
/agent tester write tests for src/tools/edit.ts
/agent fixer fix the TypeError in src/index.ts line 42
/agent documenter generate docs for the teams module
```

Built-in subagents: `researcher`, `reviewer`, `tester`, `fixer`, `documenter`.

## Skills

Create reusable workflows as `SKILL.md` files:

```
# Create a skill
mkdir -p .temu/skills/deploy
```

`.temu/skills/deploy/SKILL.md`:
```markdown
---
description: Deploy the application
---
Run the deploy pipeline:
1. Run tests with `npm test`
2. Build with `npm run build`
3. Deploy with `npm run deploy`

User input: {{args}}
```

Then use it: `/deploy production`

Skills are loaded from `~/.temu/skills/` (user) and `.temu/skills/` (project).

## Agent Teams

Ask TEMU to create a team for parallel work:

```
Create an agent team to review this codebase:
- One reviewer focused on security
- One on performance
- One checking test coverage
```

TEMU will create teammates, assign tasks, and coordinate their work. Teammates communicate via messages, share a task list, and auto-claim new tasks when done.

## Configuration

### Project Memory (`TEMU.md`)

Create a `TEMU.md` in your project root with instructions TEMU should always follow:

```markdown
# Project: My App

- Use TypeScript with strict mode
- Follow Airbnb style guide
- Run `npm test` after any code changes
```

### Settings (`~/.temu/settings.json`)

```json
{
  "model": "qwen3:14b",
  "ollamaBaseUrl": "http://localhost:11434/v1",
  "temperature": 0.7,
  "defaultMode": "default",
  "permissions": {
    "allow": ["Bash(git *)"],
    "deny": ["Bash(rm -rf *)"]
  }
}
```

## Recommended Models

| Model | VRAM | Quality | Speed | Best For |
|-------|------|---------|-------|----------|
| `qwen3:8b` | ~6GB | Good | Fast | Quick tasks, exploration |
| `qwen3:14b` | ~10GB | Very Good | Medium | General coding |
| `qwen3:32b` | ~20GB | Excellent | Slower | Complex tasks, team lead |
| `qwen2.5-coder:7b` | ~5GB | Good | Fast | Code-specific tasks |
| `llama3.1:8b` | ~6GB | Good | Fast | General purpose |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**374 tests** across 36 test files covering all core modules, tools, permissions, teams, hooks, sessions, skills, and subagents.

## Feature Comparison with Claude Code

See [FEATURES.md](FEATURES.md) for the full checklist. Highlights:

- ✅ **45+ features** matching Claude Code (agent loop, tools, permissions, sessions, hooks, skills, subagents)
- ✅ **TEMU exclusives**: Agent Teams with shared TaskList + MessageBus, Library API
- 🔲 **Not yet**: NotebookEdit, MCP, some CLI flags (`--output-format`, `--add-dir`)
- 🔒 **By design**: No cloud — Ollama-only for local privacy

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT — see [LICENSE](LICENSE)
