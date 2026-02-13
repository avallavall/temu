import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolDef } from './types.js';

export const editTool = createToolDef(
  'Edit',
  'Perform an exact string replacement in a file. The old_string must be unique in the file unless replace_all is true. old_string and new_string must be different.',
  {
    required: ['file_path', 'old_string', 'new_string'],
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to edit' },
      old_string: { type: 'string', description: 'The exact text to find and replace' },
      new_string: { type: 'string', description: 'The replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
    },
  },
  async (args, context) => {
    const filePath = path.resolve(context.cwd, args.file_path as string);
    const oldStr = args.old_string as string;
    const newStr = args.new_string as string;
    const replaceAll = (args.replace_all as boolean) ?? false;

    if (oldStr === newStr) {
      return { success: false, output: '', error: 'old_string and new_string are identical. No-op.' };
    }

    try {
      let content = await fs.readFile(filePath, 'utf-8');

      if (!replaceAll) {
        const count = content.split(oldStr).length - 1;
        if (count === 0) {
          return { success: false, output: '', error: `old_string not found in ${filePath}` };
        }
        if (count > 1) {
          return {
            success: false,
            output: '',
            error: `old_string found ${count} times in ${filePath}. Provide more context to make it unique, or set replace_all=true.`,
          };
        }
        content = content.replace(oldStr, newStr);
      } else {
        if (!content.includes(oldStr)) {
          return { success: false, output: '', error: `old_string not found in ${filePath}` };
        }
        content = content.split(oldStr).join(newStr);
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, output: `Edited ${filePath}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to edit ${filePath}: ${msg}` };
    }
  },
);
