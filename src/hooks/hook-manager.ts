import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';
import type { HookEvent, HookInput, HookOutput } from './hook-events.js';
import { HOOK_EXIT_FEEDBACK } from './hook-events.js';

export interface HookConfig {
  event: HookEvent;
  command: string;
  matcher?: string; // glob pattern to match tool names (for PreToolUse/PostToolUse)
  timeout?: number;
}

export class HookManager {
  private hooks: HookConfig[] = [];

  register(hook: HookConfig): void {
    this.hooks.push(hook);
    logger.debug(`Hook registered: ${hook.event} → ${hook.command}`);
  }

  registerAll(hooks: HookConfig[]): void {
    for (const hook of hooks) {
      this.register(hook);
    }
  }

  async loadFromSettings(settingsPath: string): Promise<void> {
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      if (settings.hooks && Array.isArray(settings.hooks)) {
        this.registerAll(settings.hooks);
      }
    } catch {
      // No hooks configured
    }
  }

  getHooksForEvent(event: HookEvent, toolName?: string): HookConfig[] {
    return this.hooks.filter((h) => {
      if (h.event !== event) return false;
      if (h.matcher && toolName) {
        return this.matchPattern(h.matcher, toolName);
      }
      return true;
    });
  }

  async fire(input: HookInput): Promise<HookOutput[]> {
    const hooks = this.getHooksForEvent(input.event, input.toolName);
    if (hooks.length === 0) return [];

    const results: HookOutput[] = [];
    for (const hook of hooks) {
      const result = await this.executeHook(hook, input);
      results.push(result);

      if (result.exitCode === HOOK_EXIT_FEEDBACK) {
        logger.info(`Hook feedback for ${input.event}: ${result.stdout.slice(0, 100)}`);
      }
    }
    return results;
  }

  private executeHook(hook: HookConfig, input: HookInput): Promise<HookOutput> {
    const timeout = hook.timeout ?? 10000;
    const inputJson = JSON.stringify(input);

    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const shellArgs = isWindows
        ? ['-NoProfile', '-Command', hook.command]
        : ['-c', hook.command];

      const proc = execFile(shell, shellArgs, {
        timeout,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          TEMU_HOOK_EVENT: input.event,
          TEMU_HOOK_INPUT: inputJson,
        },
      }, (error, stdout, stderr) => {
        const exitCode = error ? (error as any).code ?? 1 : 0;
        resolve({ exitCode, stdout: stdout.trim(), stderr: stderr.trim() });
      });

      // Send input via stdin
      proc.stdin?.write(inputJson);
      proc.stdin?.end();
    });
  }

  private matchPattern(pattern: string, value: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }
}
