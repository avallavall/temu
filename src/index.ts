#!/usr/bin/env node

// Suppress noisy node deprecation warnings (e.g., punycode) for cleaner UX
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS ?? '1';

import { Command } from 'commander';
import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';

import { OllamaProvider } from './llm/ollama-provider.js';
import { AgentLoop } from './core/agent-loop.js';
import { ToolRegistry } from './core/tool-registry.js';
import { PermissionManager, type PermissionMode } from './permissions/permission-manager.js';
import { TeamManager } from './teams/team-manager.js';
import { SessionManager } from './sessions/session.js';
import { loadSettings } from './config/settings.js';
import { loadMemoryChain } from './config/memory.js';
import { ensureTemuDirs } from './config/paths.js';
import { renderMarkdown } from './utils/markdown.js';
import { setLogLevel } from './utils/logger.js';
import { findCommand, slashCommands, type CommandContext } from './cli/commands.js';
import { HookManager } from './hooks/hook-manager.js';
import { SubagentManager } from './subagents/subagent-manager.js';
import { loadAllSkills } from './skills/skill-loader.js';

// Tools
import { readTool } from './tools/read.js';
import { writeTool } from './tools/write.js';
import { editTool } from './tools/edit.js';
import { multiEditTool } from './tools/multi-edit.js';
import { bashTool } from './tools/bash.js';
import { grepTool } from './tools/grep.js';
import { globTool } from './tools/glob.js';
import { listDirTool } from './tools/list-dir.js';
import { askUserTool } from './tools/ask-user.js';
import { createTaskTool } from './tools/task.js';
import { createTeamTool } from './tools/create-team.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('temu')
  .description('TEMU — Terminal Engine for Multi-agent Unification')
  .version(VERSION)
  .argument('[query]', 'Initial prompt to send')
  .option('-p, --print', 'Print mode: run query and exit (no interactive session)')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --continue', 'Continue the most recent session')
  .option('--verbose', 'Enable verbose logging')
  .option('--permission-mode <mode>', 'Permission mode: default, acceptEdits, plan, dontAsk, bypassPermissions')
  .option('--max-turns <n>', 'Maximum agent loop turns', parseInt)
  .option('--ollama-url <url>', 'Ollama base URL (default: http://localhost:11434/v1)')
  .action(async (query: string | undefined, opts: Record<string, unknown>) => {
    await run(query, opts);
  });

program.parse();

async function run(query: string | undefined, opts: Record<string, unknown>) {
  const cwd = process.cwd();

  // Ensure directories exist
  await ensureTemuDirs();

  // Load settings
  const settings = await loadSettings(cwd);

  if (opts.verbose) setLogLevel('debug');

  const model = (opts.model as string) ?? settings.model ?? 'qwen3:8b';
  const ollamaUrl = (opts.ollamaUrl as string) ?? settings.ollamaBaseUrl ?? 'http://localhost:11434/v1';
  const permMode = (opts.permissionMode as string) ?? settings.defaultMode ?? 'default';
  const maxTurns = (opts.maxTurns as number) ?? settings.maxTurns ?? 100;
  const isVerbose = !!opts.verbose;

  // Create LLM provider
  const provider = new OllamaProvider({
    baseUrl: ollamaUrl,
    apiKey: 'ollama',
    model,
    temperature: settings.temperature,
    topP: settings.topP,
  });

  // Verify Ollama is running
  const spinner = ora('Connecting to Ollama...').start();
  try {
    const models = await provider.listModels();
    if (models.length === 0) {
      spinner.fail('No models found in Ollama. Run: ollama pull qwen3:8b');
      process.exit(1);
    }
    if (!models.includes(model)) {
      spinner.warn(`Model "${model}" not found. Available: ${models.join(', ')}`);
    } else {
      spinner.succeed(`Connected to Ollama (${model})`);
    }
  } catch (error) {
    spinner.fail(`Cannot connect to Ollama at ${ollamaUrl}. Is Ollama running?`);
    process.exit(1);
  }

  // Create tool registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerAll([
    readTool, writeTool, editTool, multiEditTool,
    bashTool, grepTool, globTool, listDirTool, askUserTool,
  ]);

  // Task tool needs deps injected after provider is created
  // Will be registered after askUser is defined

  // Create permission manager
  const permManager = new PermissionManager(
    permMode as PermissionMode,
    settings.permissions?.allow,
    settings.permissions?.deny,
  );

  // Create hook manager
  const hookManager = new HookManager();
  if (settings.hooks) {
    hookManager.registerAll(settings.hooks);
  }

  // Load skills early so we can use them in the completer
  const skills = await loadAllSkills(cwd);

  // Build slash command completions for tab-autocomplete
  const slashCompletions: string[] = [];
  for (const cmd of slashCommands) {
    slashCompletions.push('/' + cmd.name);
    for (const alias of cmd.aliases) {
      slashCompletions.push('/' + alias);
    }
  }
  for (const skill of skills) {
    slashCompletions.push('/' + skill.name);
  }

  // Create readline interface with tab completion
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string) => {
      if (line.startsWith('/')) {
        const hits = slashCompletions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : slashCompletions, line];
      }
      return [[], line];
    },
  });

  const askUser = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(chalk.yellow(`? ${question} `), (answer: string) => {
        resolve(answer);
      });
    });
  };

  // Register Task tool now that we have askUser
  const taskTool = createTaskTool({ provider, toolRegistry, cwd, askUser });
  toolRegistry.register(taskTool);

  // CreateTeam tool - uses lazy getter since teamManager is created later
  let teamManagerRef: TeamManager | null = null;
  const teamTool = createTeamTool({ getTeamManager: () => teamManagerRef! });
  toolRegistry.register(teamTool);

  // Load project memory
  const projectMemory = await loadMemoryChain(cwd);

  // Session manager
  const sessionManager = new SessionManager();
  const session = await sessionManager.create(cwd, model);

  // Subagent manager
  const subagentManager = new SubagentManager({ provider, toolRegistry, cwd, askUser });

  // Skills already loaded above for completer

  // Fire SessionStart hook
  await hookManager.fire({ event: 'SessionStart', sessionId: session.id, timestamp: Date.now() });

  // Create agent loop
  let currentModel = model;
  const createAgentLoop = () => new AgentLoop({
    provider,
    toolRegistry,
    toolContext: {
      cwd,
      permissions: permManager,
      askUser,
    },
    cwd,
    model: currentModel,
    projectMemory,
    maxTurns,
    onContent: (content) => {
      process.stdout.write(renderMarkdown(content));
      process.stdout.write('\n');
    },
    onToolCall: (name, args) => {
      if (!isVerbose) return;
      const argsStr = JSON.stringify(args).slice(0, 80);
      console.error(chalk.dim(`  ▸ ${name}(${argsStr})`));
    },
    onToolResult: (name, result) => {
      if (!isVerbose && result.success) return;
      const icon = result.success ? chalk.green('✓') : chalk.red('✗');
      const preview = result.output.slice(0, 60).replace(/\n/g, ' ');
      console.error(chalk.dim(`  ${icon} ${name}: ${preview}`));
    },
    onCompaction: () => {
      console.error(chalk.dim('  ↻ Compacting context...'));
    },
    onAllowAlways: async (toolName) => {
      // Persist the allow rule to project settings
      const projSettingsPath = path.join(cwd, '.temu', 'settings.json');
      let existing: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(projSettingsPath, 'utf-8');
        existing = JSON.parse(raw);
      } catch { /* no existing settings */ }
      const perms = (existing.permissions ?? {}) as Record<string, unknown>;
      const allow = (perms.allow ?? []) as string[];
      if (!allow.includes(toolName)) {
        allow.push(toolName);
      }
      perms.allow = allow;
      existing.permissions = perms;
      await fs.mkdir(path.join(cwd, '.temu'), { recursive: true });
      await fs.writeFile(projSettingsPath, JSON.stringify(existing, null, 2), 'utf-8');
      console.error(chalk.green(`  ✓ Added "${toolName}" to always-allow rules (.temu/settings.json)`));
    },
  });

  let agentLoop = createAgentLoop();

  // Create team manager
  const teamManager: TeamManager = new TeamManager({
    provider,
    toolRegistry,
    cwd,
    callbacks: {
      onTeammateContent: (name, content) => {
        console.error(chalk.magenta(`  [${name}] `) + content.slice(0, 100));
      },
      onTeammateStatusChange: (name, status) => {
        console.error(chalk.dim(`  [${name}] status: ${status}`));
      },
      onTeammateTaskComplete: (name, taskId) => {
        console.error(chalk.green(`  [${name}] ✓ completed task ${taskId}`));
      },
      onAllTasksComplete: () => {
        console.error(chalk.bold.green('\n  ✓ All team tasks completed!\n'));
      },
      askUser,
    },
  });
  teamManagerRef = teamManager;

  // Command context
  const cmdCtx: CommandContext = {
    agentLoop,
    teamManager,
    sessionManager,
    provider,
    subagentManager,
    skills,
    currentModel,
    cwd,
    print: (text) => console.log(text),
    _rl: rl,
    setModel: (m) => {
      currentModel = m;
      cmdCtx.currentModel = m;
      provider.setModel(m);
      agentLoop = createAgentLoop();
      cmdCtx.agentLoop = agentLoop;
    },
    getDisplayMode: () => teamManager.getDisplayMode(),
    setDisplayMode: (mode) => {
      teamManager.setDisplayMode(mode);
    },
  };

  // Continue mode: resume last session
  if (opts.continue) {
    const lastSession = await sessionManager.getLatest();
    if (lastSession) {
      console.log(chalk.dim(`Resuming session ${lastSession.id.slice(0, 8)} (${lastSession.name})`));
    } else {
      console.log(chalk.dim('No previous session found. Starting fresh.'));
    }
  }

  // Print mode: run once and exit
  if (opts.print && query) {
    const pipeInput = await readStdin();
    const fullQuery = pipeInput ? `${pipeInput}\n\n${query}` : query;

    const result = await agentLoop.run(fullQuery);
    if (result.finalContent) {
      process.stdout.write(result.finalContent);
    }
    rl.close();
    process.exit(0);
  }

  // One-shot mode: query provided without -p
  if (query && !opts.print) {
    await agentLoop.run(query);
  }

  // Interactive mode
  printBanner(model, cwd);

  const promptUser = () => {
    const prefix = teamManager.isActive()
      ? chalk.magenta(`[${teamManager.getTeamName()}] `)
      : '';
    rl.question(`${prefix}${chalk.bold.green('temu')}${chalk.dim(' > ')}`, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        promptUser();
        return;
      }

      // Slash commands
      const cmd = findCommand(trimmed, skills);
      if (cmd) {
        const shouldExit = await cmd.command.execute(cmd.args, cmdCtx);
        if (shouldExit) {
          console.log(chalk.dim('Goodbye!'));
          rl.close();
          if (teamManager.isActive()) await teamManager.cleanup();
          process.exit(0);
        }
        promptUser();
        return;
      }

      // Fire UserPromptSubmit hook
      await hookManager.fire({ event: 'UserPromptSubmit', sessionId: session.id, timestamp: Date.now() });

      // Regular prompt to agent
      try {
        const result = await agentLoop.run(trimmed);
        session.messageCount += result.turns;
        session.totalTokens += result.totalTokens;
        await sessionManager.save(session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${msg}`));
      }

      promptUser();
    });
  };

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    agentLoop.abort();
    console.log(chalk.dim('\n(interrupted)'));
    promptUser();
  });

  promptUser();
}

function printBanner(model: string, cwd: string) {
  console.log('');
  console.log(chalk.bold.cyan('  ╔════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold('  TEMU — Agentic Coding Assistant   ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ║') + chalk.dim('  Powered by Ollama (local models)  ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ╚════════════════════════════════════════╝'));
  console.log('');
  console.log(`  ${chalk.dim('Model:')} ${chalk.cyan(model)}`);
  console.log(`  ${chalk.dim('Dir:')}   ${chalk.cyan(cwd)}`);
  console.log(`  ${chalk.dim('Help:')}  ${chalk.cyan('/help')}  ${chalk.dim('Exit:')} ${chalk.cyan('/exit')}`);
  console.log('');
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';

  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // If no data after 100ms, assume interactive
    setTimeout(() => resolve(data), 100);
  });
}
