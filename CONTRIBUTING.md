# Contributing to TEMU

Thanks for your interest in contributing to TEMU! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/avallavall/temu.git
cd temu

# Install dependencies
npm install

# Make sure Ollama is running
ollama pull qwen3:8b

# Run in dev mode
npx tsx src/index.ts

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── lib.ts            # Library barrel export
├── cli/              # Slash commands
├── config/           # Paths, settings, memory
├── core/             # Agent loop, context, tools
├── hooks/            # Lifecycle hooks
├── llm/              # Ollama provider, token counter
├── permissions/      # Permission manager
├── sessions/         # Session persistence
├── skills/           # Skill loader
├── subagents/        # Subagent configs and manager
├── teams/            # Multi-agent teams
├── tools/            # Built-in tools
└── utils/            # Logger, markdown, diff
tests/                # Vitest test files
```

## Guidelines

- **TypeScript strict** — No `any` where avoidable, all exports typed
- **Tests** — Add tests for new features. Run `npm test` before submitting
- **Keep it simple** — Avoid unnecessary abstractions
- **Tools** — Follow the `createToolDef()` pattern in `src/tools/types.ts`
- **Formatting** — 2-space indent, single quotes, trailing comma

## Adding a New Tool

1. Create `src/tools/my-tool.ts` using `createToolDef()`
2. Register it in `src/index.ts` via `toolRegistry.register()`
3. Add tests in `tests/tools-my-tool.test.ts`

## Adding a Built-in Subagent

1. Add config to `BUILTIN_SUBAGENTS` in `src/subagents/subagent-config.ts`
2. Add tests in `tests/subagent-config.test.ts`

## Pull Requests

- Fork the repo and create a feature branch
- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Ensure all tests pass and TypeScript compiles cleanly
