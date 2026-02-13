import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { editTool } from '../src/tools/edit.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('Edit tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-edit-'));
    context.cwd = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('replaces unique string', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello world');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'hello',
      new_string: 'goodbye',
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('goodbye world');
  });

  it('fails when old_string equals new_string', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'hello',
      new_string: 'hello',
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('identical');
  });

  it('fails when old_string not found', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'xyz',
      new_string: 'abc',
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when old_string is not unique', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb aaa');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'aaa',
      new_string: 'ccc',
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 times');
  });

  it('replaces all occurrences with replace_all=true', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'aaa bbb aaa');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'aaa',
      new_string: 'ccc',
      replace_all: true,
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('ccc bbb ccc');
  });

  it('replace_all fails when string not found', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    const result = await editTool.execute({
      file_path: 'file.txt',
      old_string: 'xyz',
      new_string: 'abc',
      replace_all: true,
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails on non-existent file', async () => {
    const result = await editTool.execute({
      file_path: 'nope.txt',
      old_string: 'a',
      new_string: 'b',
    }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to edit');
  });

  it('handles multiline old_string', async () => {
    await fs.writeFile(path.join(tmpDir, 'ml.txt'), 'line1\nline2\nline3');
    const result = await editTool.execute({
      file_path: 'ml.txt',
      old_string: 'line1\nline2',
      new_string: 'replaced',
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'ml.txt'), 'utf-8');
    expect(content).toBe('replaced\nline3');
  });

  it('preserves file encoding on edit', async () => {
    const special = 'café résumé naïve';
    await fs.writeFile(path.join(tmpDir, 'utf.txt'), special);
    const result = await editTool.execute({
      file_path: 'utf.txt',
      old_string: 'café',
      new_string: 'coffee',
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'utf.txt'), 'utf-8');
    expect(content).toBe('coffee résumé naïve');
  });
});
