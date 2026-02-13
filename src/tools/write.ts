import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolDef } from './types.js';

export const writeTool = createToolDef(
  'Write',
  'Create a new file with the given content. Parent directories are created automatically. Fails if the file already exists.',
  {
    required: ['file_path', 'content'],
    properties: {
      file_path: { type: 'string', description: 'Absolute path for the new file' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
  },
  async (args, context) => {
    const rawPath = (args.file_path as string ?? '').trim();
    if (!rawPath || rawPath === 'unknown') {
      return { success: false, output: '', error: 'file_path is required. Provide the full absolute path for the new file.' };
    }
    const content = (args.content as string) ?? '';
    const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(context.cwd, rawPath);

    try {
      // Check if file already exists
      try {
        await fs.access(filePath);
        return { success: false, output: '', error: `File already exists: ${filePath}. Use Edit to modify existing files.` };
      } catch {
        // File doesn't exist, good
      }

      // Create parent directories
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');

      const lines = content.split('\n').length;
      return { success: true, output: `Created ${filePath} (${lines} lines, ${content.length} chars)` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to write ${filePath}: ${msg}` };
    }
  },
);
