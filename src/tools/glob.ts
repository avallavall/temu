import { execFile } from 'node:child_process';
import path from 'node:path';
import { createToolDef } from './types.js';

export const globTool = createToolDef(
  'Glob',
  'Search for files by name pattern using fd (or fallback). Returns file paths matching the pattern.',
  {
    required: ['pattern', 'search_path'],
    properties: {
      pattern: { type: 'string', description: 'Glob pattern to search for (e.g., "*.ts", "test_*")' },
      search_path: { type: 'string', description: 'Directory to search in' },
      type: { type: 'string', enum: ['file', 'directory', 'any'], description: 'Filter by type (default: file)' },
      max_depth: { type: 'integer', description: 'Maximum directory depth to search' },
      extensions: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to include (without dot)',
      },
    },
  },
  async (args, context) => {
    const pattern = args.pattern as string;
    const searchPath = path.resolve(context.cwd, args.search_path as string);
    const type = (args.type as string) ?? 'file';
    const maxDepth = args.max_depth as number | undefined;
    const extensions = args.extensions as string[] | undefined;

    const fdArgs: string[] = ['--glob', pattern];

    if (type === 'file') fdArgs.push('--type', 'f');
    else if (type === 'directory') fdArgs.push('--type', 'd');

    if (maxDepth) fdArgs.push('--max-depth', String(maxDepth));

    if (extensions) {
      for (const ext of extensions) {
        fdArgs.push('--extension', ext);
      }
    }

    fdArgs.push('--max-results', '50');
    fdArgs.push('.', searchPath);

    return new Promise((resolve) => {
      execFile('fd', fdArgs, {
        cwd: context.cwd,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      }, (error, stdout) => {
        if (error && !stdout) {
          // Fallback to PowerShell/find
          resolve(fallbackGlob(pattern, searchPath, context.cwd));
        } else {
          resolve({ success: true, output: stdout.trim() || 'No files found.' });
        }
      });
    });
  },
);

function fallbackGlob(pattern: string, searchPath: string, cwd: string): Promise<import('./types.js').ToolResult> {
  const isWindows = process.platform === 'win32';

  return new Promise((resolve) => {
    if (isWindows) {
      execFile('powershell.exe', [
        '-NoProfile', '-Command',
        `Get-ChildItem -Path "${searchPath}" -Recurse -Name -Filter "${pattern}" | Select-Object -First 50`,
      ], { cwd, timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
        resolve({ success: true, output: stdout.trim() || 'No files found.' });
      });
    } else {
      execFile('find', [searchPath, '-name', pattern, '-maxdepth', '10'], {
        cwd, timeout: 10000, maxBuffer: 1024 * 1024,
      }, (error, stdout) => {
        resolve({ success: true, output: stdout.trim() || 'No files found.' });
      });
    }
  });
}
