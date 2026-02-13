import { execFile } from 'node:child_process';
import path from 'node:path';
import { createToolDef } from './types.js';

export const grepTool = createToolDef(
  'Grep',
  'Search for text/regex patterns in files using ripgrep. Returns matching files and optionally matching lines with context.',
  {
    required: ['query', 'search_path'],
    properties: {
      query: { type: 'string', description: 'Search pattern (regex by default)' },
      search_path: { type: 'string', description: 'Directory or file to search in' },
      includes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns to include (e.g., "*.ts", "*.py")',
      },
      fixed_strings: { type: 'boolean', description: 'Treat query as literal string (default: false)' },
      case_sensitive: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
      match_per_line: { type: 'boolean', description: 'Show matching lines with context (default: false, just show file names)' },
    },
  },
  async (args, context) => {
    const query = args.query as string;
    const searchPath = path.resolve(context.cwd, args.search_path as string);
    const includes = args.includes as string[] | undefined;
    const fixedStrings = (args.fixed_strings as boolean) ?? false;
    const caseSensitive = (args.case_sensitive as boolean) ?? false;
    const matchPerLine = (args.match_per_line as boolean) ?? false;

    const rgArgs: string[] = [];

    if (!matchPerLine) {
      rgArgs.push('--files-with-matches');
    } else {
      rgArgs.push('--line-number', '--context', '2');
    }

    if (fixedStrings) rgArgs.push('--fixed-strings');
    if (!caseSensitive) rgArgs.push('--ignore-case');

    if (includes) {
      for (const glob of includes) {
        rgArgs.push('--glob', glob);
      }
    }

    rgArgs.push('--max-count', '50');
    rgArgs.push('--', query, searchPath);

    return new Promise((resolve) => {
      execFile('rg', rgArgs, {
        cwd: context.cwd,
        timeout: 15000,
        maxBuffer: 1024 * 1024 * 5,
      }, (error, stdout, stderr) => {
        if (error && !stdout) {
          // rg returns exit code 1 when no matches found
          if (error.code === 1) {
            resolve({ success: true, output: 'No matches found.' });
          } else {
            // Try fallback to findstr on Windows / grep on Unix
            resolve(fallbackGrep(query, searchPath, context.cwd));
          }
        } else {
          const output = stdout.trim();
          resolve({
            success: true,
            output: output || 'No matches found.',
          });
        }
      });
    });
  },
);

function fallbackGrep(query: string, searchPath: string, cwd: string): Promise<import('./types.js').ToolResult> {
  const isWindows = process.platform === 'win32';

  return new Promise((resolve) => {
    if (isWindows) {
      execFile('powershell.exe', [
        '-NoProfile', '-Command',
        `Get-ChildItem -Path "${searchPath}" -Recurse -File | Select-String -Pattern "${query}" -List | Select-Object -First 50 | ForEach-Object { $_.Path + ":" + $_.LineNumber + ":" + $_.Line }`,
      ], { cwd, timeout: 15000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout) => {
        resolve({ success: true, output: stdout.trim() || 'No matches found.' });
      });
    } else {
      execFile('grep', ['-r', '-l', '--max-count=50', query, searchPath], {
        cwd, timeout: 15000, maxBuffer: 1024 * 1024 * 5,
      }, (error, stdout) => {
        resolve({ success: true, output: stdout.trim() || 'No matches found.' });
      });
    }
  });
}
