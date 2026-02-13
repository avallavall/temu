import fs from 'node:fs/promises';
import path from 'node:path';
import { createToolDef } from './types.js';

interface EditOp {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export const multiEditTool = createToolDef(
  'MultiEdit',
  'Perform multiple sequential find-and-replace edits on a single file atomically. All edits must succeed or none are applied.',
  {
    required: ['file_path', 'edits'],
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to edit' },
      edits: {
        type: 'array',
        description: 'Array of edit operations: [{old_string, new_string, replace_all?}]',
        items: {
          type: 'object',
          required: ['old_string', 'new_string'],
          properties: {
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' },
          },
        },
      },
    },
  },
  async (args, context) => {
    const filePath = path.resolve(context.cwd, args.file_path as string);
    const edits = args.edits as EditOp[];

    if (!edits || edits.length === 0) {
      return { success: false, output: '', error: 'No edits provided' };
    }

    try {
      let content = await fs.readFile(filePath, 'utf-8');
      const original = content;

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (edit.old_string === edit.new_string) {
          return { success: false, output: '', error: `Edit ${i}: old_string and new_string are identical` };
        }

        if (!edit.replace_all) {
          const count = content.split(edit.old_string).length - 1;
          if (count === 0) {
            // Restore original on failure
            return { success: false, output: '', error: `Edit ${i}: old_string not found in file` };
          }
          if (count > 1) {
            return { success: false, output: '', error: `Edit ${i}: old_string found ${count} times. Use replace_all or add more context.` };
          }
          content = content.replace(edit.old_string, edit.new_string);
        } else {
          if (!content.includes(edit.old_string)) {
            return { success: false, output: '', error: `Edit ${i}: old_string not found in file` };
          }
          content = content.split(edit.old_string).join(edit.new_string);
        }
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, output: `Applied ${edits.length} edits to ${filePath}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, output: '', error: `Failed to edit ${filePath}: ${msg}` };
    }
  },
);
