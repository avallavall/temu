import type { AgentLoop } from '../core/agent-loop.js';
import type { TeamManager } from '../teams/team-manager.js';
import type { SessionManager } from '../sessions/session.js';
import type { OllamaProvider } from '../llm/ollama-provider.js';
import type { SubagentManager } from '../subagents/subagent-manager.js';
import type { Skill } from '../skills/skill-loader.js';
import { skillToPrompt } from '../skills/skill-loader.js';
import { renderMarkdown } from '../utils/markdown.js';
import chalk from 'chalk';

export interface CommandContext {
  agentLoop: AgentLoop | null;
  teamManager: TeamManager;
  sessionManager: SessionManager;
  provider: OllamaProvider;
  subagentManager: SubagentManager;
  skills: Skill[];
  currentModel: string;
  cwd: string;
  print: (text: string) => void;
  setModel: (model: string) => void;
  getDisplayMode?: () => 'in-process' | 'split-pane';
  setDisplayMode?: (mode: 'in-process' | 'split-pane') => void;
  _rl?: import('node:readline').Interface;
}

interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<boolean>; // return true to exit
}

export const slashCommands: SlashCommand[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    execute: async (_args, ctx) => {
      const lines = slashCommands.map((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.map((a) => '/' + a).join(', ')})` : '';
        return `  ${chalk.cyan('/' + cmd.name)}${chalk.dim(aliases)} — ${cmd.description}`;
      });
      ctx.print(chalk.bold('\nAvailable commands:\n') + lines.join('\n') + '\n');
      return false;
    },
  },
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit TEMU',
    execute: async () => true,
  },
  {
    name: 'clear',
    aliases: [],
    description: 'Clear conversation context',
    execute: async (_args, ctx) => {
      ctx.agentLoop?.getContextManager().clear();
      ctx.print(chalk.yellow('Context cleared.'));
      return false;
    },
  },
  {
    name: 'model',
    aliases: ['m'],
    description: 'View or change the current model. Usage: /model [name]',
    execute: async (args, ctx) => {
      const input = args.trim();
      if (input) {
        ctx.setModel(input);
        ctx.print(`Model changed to: ${chalk.cyan(input)}`);
        return false;
      }

      const models = await ctx.provider.listModels();
      if (models.length === 0) {
        ctx.print('No models available. Pull one with `ollama pull qwen3:8b`.');
        return false;
      }

      let idx = Math.max(0, models.indexOf(ctx.currentModel));
      const render = () => {
        const lines = [
          `Use ↑/↓ and Enter. ESC to cancel.`,
          `Current: ${chalk.cyan(ctx.currentModel)}`,
          '',
          ...models.map((m, i) => (i === idx ? `${chalk.green('>')} ${chalk.bold(m)}` : `  ${m}`)),
        ];
        ctx.print(lines.join('\n'));
      };

      const rl = (ctx as any)._rl as import('node:readline').Interface | undefined;
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (!wasRaw) stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      return await new Promise<boolean>((resolve) => {
        const onData = (chunk: string) => {
          if (chunk === '\u0003') {
            cleanup();
            return resolve(false);
          }
          if (chunk === '\u001b[A') { // up
            idx = (idx - 1 + models.length) % models.length;
            rerender();
          } else if (chunk === '\u001b[B') { // down
            idx = (idx + 1) % models.length;
            rerender();
          } else if (chunk === '\r') { // enter
            const chosen = models[idx];
            ctx.setModel(chosen);
            ctx.print(`Model changed to: ${chalk.cyan(chosen)}`);
            cleanup();
            resolve(false);
          } else if (chunk === '\u001b') { // esc
            cleanup();
            resolve(false);
          }
        };

        const cleanup = () => {
          stdin.off('data', onData);
          if (!wasRaw) stdin.setRawMode?.(false);
          stdin.pause();
          if (rl) rl.prompt(true);
        };

        const rerender = () => {
          // Clear last render block (simple approach: write ANSI clear screen)
          process.stdout.write('\x1b[2J\x1b[0f');
          render();
        };

        render();
        stdin.on('data', onData);
      });
    },
  },
  {
    name: 'compact',
    aliases: [],
    description: 'Manually compact conversation context',
    execute: async (_args, ctx) => {
      if (!ctx.agentLoop) {
        ctx.print(chalk.yellow('No active conversation.'));
        return false;
      }
      ctx.print(chalk.dim('Compacting context...'));
      await ctx.agentLoop.getContextManager().compact(ctx.provider);
      ctx.print(chalk.green('Context compacted.'));
      return false;
    },
  },
  {
    name: 'cost',
    aliases: ['usage'],
    description: 'Show token usage for this session',
    execute: async (_args, ctx) => {
      const tokens = ctx.agentLoop?.getContextManager().getTokenEstimate() ?? 0;
      ctx.print(`Current context: ~${tokens} tokens`);
      return false;
    },
  },
  {
    name: 'tasks',
    aliases: ['t'],
    description: 'Show current task list (for agent teams)',
    execute: async (_args, ctx) => {
      const taskList = ctx.teamManager.getTaskList();
      if (!taskList) {
        ctx.print(chalk.dim('No active team. Start a team to see tasks.'));
        return false;
      }
      ctx.print(taskList.toSummary());
      return false;
    },
  },
  {
    name: 'team',
    aliases: [],
    description: 'Show team status or manage team',
    execute: async (_args, ctx) => {
      if (!ctx.teamManager.isActive()) {
        ctx.print(chalk.dim('No active team. Ask me to create one!'));
        return false;
      }
      ctx.print(ctx.teamManager.getTeamSummary());
      return false;
    },
  },
  {
    name: 'teamview',
    aliases: ['tv'],
    description: 'Show split-pane style view of team (teammates + tasks)',
    execute: async (_args, ctx) => {
      if (!ctx.teamManager.isActive()) {
        ctx.print(chalk.dim('No active team. Ask me to create one!'));
        return false;
      }
      ctx.print(ctx.teamManager.getSplitPaneView());
      return false;
    },
  },
  {
    name: 'displaymode',
    aliases: ['dm'],
    description: 'Set display mode: in-process or split-pane. Usage: /displaymode split-pane',
    execute: async (args, ctx) => {
      const mode = args.trim() as 'in-process' | 'split-pane';
      if (!mode) {
        ctx.print(`Current mode: ${ctx.getDisplayMode ? ctx.getDisplayMode() : 'in-process'}`);
        ctx.print('Usage: /displaymode in-process | split-pane');
        return false;
      }
      if (mode !== 'in-process' && mode !== 'split-pane') {
        ctx.print('Invalid mode. Use: in-process or split-pane');
        return false;
      }
      if (ctx.setDisplayMode) {
        ctx.setDisplayMode(mode);
      }
      ctx.print(`Display mode set to: ${mode}`);
      return false;
    },
  },
  {
    name: 'sessions',
    aliases: [],
    description: 'List recent sessions',
    execute: async (_args, ctx) => {
      const sessions = await ctx.sessionManager.list();
      if (sessions.length === 0) {
        ctx.print(chalk.dim('No previous sessions.'));
        return false;
      }
      for (const s of sessions.slice(0, 10)) {
        const date = new Date(s.updatedAt).toLocaleString();
        ctx.print(`  ${chalk.cyan(s.id.slice(0, 8))} ${s.name} — ${date} (${s.messageCount} msgs)`);
      }
      return false;
    },
  },
  {
    name: 'plan',
    aliases: [],
    description: 'Switch to plan mode (read-only)',
    execute: async (_args, ctx) => {
      ctx.print(chalk.yellow('Plan mode: agent will only read and analyze, no edits.'));
      return false;
    },
  },
  {
    name: 'agent',
    aliases: ['subagent'],
    description: 'Run a subagent. Usage: /agent <name> <prompt>',
    execute: async (args, ctx) => {
      if (!args.trim()) {
        const available = ctx.subagentManager.listAvailable();
        ctx.print(chalk.bold('\nAvailable subagents:\n'));
        for (const a of available) {
          ctx.print(`  ${chalk.cyan(a.name)} — ${a.description}`);
        }
        ctx.print(`\n  Usage: ${chalk.cyan('/agent <name> <prompt>')}\n`);
        return false;
      }
      const spaceIdx = args.indexOf(' ');
      const name = spaceIdx > 0 ? args.slice(0, spaceIdx) : args;
      const prompt = spaceIdx > 0 ? args.slice(spaceIdx + 1) : '';

      if (!prompt) {
        ctx.print(chalk.yellow(`Usage: /agent ${name} <what to do>`));
        return false;
      }

      ctx.print(chalk.dim(`Running subagent "${name}"...`));
      const result = await ctx.subagentManager.run(name, prompt, {
        onContent: (content) => ctx.print(renderMarkdown(content)),
        onToolCall: (toolName, toolArgs) => {
          ctx.print(chalk.dim(`  ▸ ${toolName}(${JSON.stringify(toolArgs).slice(0, 60)})`));
        },
      });

      if (!result.success) {
        ctx.print(chalk.red(`Subagent failed: ${result.error}`));
      } else {
        ctx.print(chalk.green(`\n✓ Subagent "${name}" completed in ${result.turns} turns`));
      }
      return false;
    },
  },
  {
    name: 'skills',
    aliases: [],
    description: 'List loaded skills',
    execute: async (_args, ctx) => {
      if (ctx.skills.length === 0) {
        ctx.print(chalk.dim('No skills loaded. Create .temu/skills/<name>/SKILL.md'));
        return false;
      }
      ctx.print(chalk.bold('\nLoaded skills:\n'));
      for (const s of ctx.skills) {
        ctx.print(`  ${chalk.cyan('/' + s.name)} — ${s.description} ${chalk.dim(`(${s.source})`)}`);
      }
      ctx.print('');
      return false;
    },
  },
];

export function findCommand(input: string, skills?: Skill[]): { command: SlashCommand; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const cmdName = (spaceIdx > 0 ? trimmed.slice(1, spaceIdx) : trimmed.slice(1)).toLowerCase();
  const args = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1) : '';

  for (const cmd of slashCommands) {
    if (cmd.name === cmdName || cmd.aliases.includes(cmdName)) {
      return { command: cmd, args };
    }
  }

  // Check if it matches a loaded skill name
  if (skills) {
    const skill = skills.find((s) => s.name.toLowerCase() === cmdName);
    if (skill) {
      const skillCmd: SlashCommand = {
        name: skill.name,
        aliases: [],
        description: skill.description,
        execute: async (skillArgs, ctx) => {
          const prompt = skillToPrompt(skill, skillArgs);
          ctx.print(chalk.dim(`Running skill "${skill.name}"...`));
          try {
            await ctx.agentLoop?.run(prompt);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            ctx.print(chalk.red(`Skill error: ${msg}`));
          }
          return false;
        },
      };
      return { command: skillCmd, args };
    }
  }

  return null;
}
