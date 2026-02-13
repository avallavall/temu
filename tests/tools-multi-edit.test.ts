import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { multiEditTool } from '../src/tools/multi-edit.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('MultiEdit tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-multiedit-'));
    context.cwd = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('applies multiple edits sequentially', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb ccc');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'aaa', new_string: 'AAA' },
        { old_string: 'bbb', new_string: 'BBB' },
      ],
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('AAA BBB ccc');
  });

  it('fails with empty edits array', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'content');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [],
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No edits');
  });

  it('fails if any edit has identical old and new string', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'aaa', new_string: 'AAA' },
        { old_string: 'bbb', new_string: 'bbb' },
      ],
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Edit 1');
    expect(result.error).toContain('identical');
  });

  it('fails if old_string not found in any edit', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello world');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'nonexistent', new_string: 'replaced' },
      ],
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails if old_string is not unique without replace_all', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb aaa');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'aaa', new_string: 'ccc' },
      ],
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 times');
  });

  it('supports replace_all in individual edits', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb aaa');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'aaa', new_string: 'ccc', replace_all: true },
      ],
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('ccc bbb ccc');
  });

  it('edits are applied in sequence (later edits see earlier changes)', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'foo bar');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'foo', new_string: 'baz' },
        { old_string: 'baz bar', new_string: 'final' },
      ],
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('final');
  });

  it('fails on non-existent file', async () => {
    const result = await multiEditTool.execute({
      file_path: 'nope.txt',
      edits: [{ old_string: 'a', new_string: 'b' }],
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to edit');
  });

  it('reports number of edits applied', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'a b c');
    const result = await multiEditTool.execute({
      file_path: 'file.txt',
      edits: [
        { old_string: 'a', new_string: 'A' },
        { old_string: 'b', new_string: 'B' },
        { old_string: 'c', new_string: 'C' },
      ],
    }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('3 edits');
  });
});
