import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolDef } from './types.js';

export const listDirTool = createToolDef(
  'ListDir',
  'List files and directories in a given path. Shows type, size, and name for each entry.',
  {
    required: ['dir_path'],
    properties: {
      dir_path: { type: 'string', description: 'Absolute path to the directory to list' },
    },
  },
  async (args, context) => {
    const dirPath = path.resolve(context.cwd, args.dir_path as string);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          if (entry.isDirectory()) {
            // Count recursive items
            let count = 0;
            try {
              const sub = await fs.readdir(fullPath);
              count = sub.length;
            } catch { /* skip */ }
            lines.push(`  [dir]  ${entry.name}/ (${count} items)`);
          } else {
            const size = formatSize(stat.size);
            lines.push(`  [file] ${entry.name} (${size})`);
          }
        } catch {
          lines.push(`  [?]    ${entry.name}`);
        }
      }

      if (lines.length === 0) {
        return { success: true, output: `${dirPath}: empty directory` };
      }

      return { success: true, output: `${dirPath}:\n${lines.join('\n')}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to list ${dirPath}: ${msg}` };
    }
  },
);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
