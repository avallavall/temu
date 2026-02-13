import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export const logger = {
  debug(...args: unknown[]) {
    if (shouldLog('debug')) {
      console.error(chalk.gray(`[${timestamp()}] DBG`), ...args);
    }
  },

  info(...args: unknown[]) {
    if (shouldLog('info')) {
      console.error(chalk.blue(`[${timestamp()}] INF`), ...args);
    }
  },

  warn(...args: unknown[]) {
    if (shouldLog('warn')) {
      console.error(chalk.yellow(`[${timestamp()}] WRN`), ...args);
    }
  },

  error(...args: unknown[]) {
    if (shouldLog('error')) {
      console.error(chalk.red(`[${timestamp()}] ERR`), ...args);
    }
  },

  tool(name: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.error(chalk.magenta(`[${timestamp()}] TOOL:${name}`), ...args);
    }
  },

  agent(name: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.error(chalk.cyan(`[${timestamp()}] AGENT:${name}`), ...args);
    }
  },
};
