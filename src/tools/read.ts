import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolDef } from './types.js';

export const readTool = createToolDef(
  'Read',
  'Read the contents of a file at the given path. Returns lines with 1-indexed line numbers.',
  {
    required: ['file_path'],
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to read' },
      offset: { type: 'integer', description: 'Line number to start reading from (1-indexed)' },
      limit: { type: 'integer', description: 'Number of lines to read' },
    },
  },
  async (args, context) => {
    const filePath = path.resolve(context.cwd, args.file_path as string);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const offset = (args.offset as number | undefined) ?? 1;
      const limit = (args.limit as number | undefined) ?? lines.length;

      const start = Math.max(0, offset - 1);
      const end = Math.min(lines.length, start + limit);
      const slice = lines.slice(start, end);

      const numbered = slice.map((line, i) => {
        const lineNum = String(start + i + 1).padStart(6, ' ');
        return `${lineNum}\t${line}`;
      }).join('\n');

      return { success: true, output: numbered };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to read ${filePath}: ${msg}` };
    }
  },
);
