import { execFile } from 'node:child_process';
import { createToolDef } from './types.js';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

export const bashTool = createToolDef(
  'Bash',
  'Execute a shell command and return stdout/stderr. Commands run in the project working directory.',
  {
    required: ['command'],
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'integer', description: 'Timeout in milliseconds (default: 30000)' },
      cwd: { type: 'string', description: 'Working directory for the command (default: project root)' },
    },
  },
  async (args, context) => {
    const command = args.command as string;
    const timeout = (args.timeout as number) ?? DEFAULT_TIMEOUT;
    const cwd = (args.cwd as string) ?? context.cwd;

    // Determine shell based on platform
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];

    return new Promise((resolve) => {
      const proc = execFile(shell, shellArgs, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        env: { ...process.env },
      }, (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join('\n');

        if (error) {
          if (error.killed) {
            resolve({ success: false, output, error: `Command timed out after ${timeout}ms` });
          } else {
            resolve({ success: false, output, error: `Exit code ${error.code}: ${error.message}` });
          }
        } else {
          resolve({ success: true, output: output || '(no output)' });
        }
      });

      // Handle abort
      if (context.abortSignal) {
        context.abortSignal.addEventListener('abort', () => {
          proc.kill('SIGTERM');
        });
      }
    });
  },
);
