import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listDirTool } from '../src/tools/list-dir.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('ListDir tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-listdir-'));
    context.cwd = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists files and directories', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'content');
    await fs.mkdir(path.join(tmpDir, 'subdir'));
    const result = await listDirTool.execute({ dir_path: '.' }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('file.txt');
    expect(result.output).toContain('subdir');
  });

  it('shows [dir] and [file] markers', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'x');
    await fs.mkdir(path.join(tmpDir, 'dir'));
    const result = await listDirTool.execute({ dir_path: '.' }, context);
    expect(result.output).toContain('[file]');
    expect(result.output).toContain('[dir]');
  });

  it('shows file sizes', async () => {
    await fs.writeFile(path.join(tmpDir, 'small.txt'), 'hi');
    const result = await listDirTool.execute({ dir_path: '.' }, context);
    expect(result.output).toMatch(/\d+B/);
  });

  it('shows item count for directories', async () => {
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(path.join(tmpDir, 'sub', 'a.txt'), 'a');
    await fs.writeFile(path.join(tmpDir, 'sub', 'b.txt'), 'b');
    const result = await listDirTool.execute({ dir_path: '.' }, context);
    expect(result.output).toContain('2 items');
  });

  it('handles empty directory', async () => {
    const emptyDir = path.join(tmpDir, 'empty');
    await fs.mkdir(emptyDir);
    const result = await listDirTool.execute({ dir_path: 'empty' }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('empty directory');
  });

  it('fails on non-existent directory', async () => {
    const result = await listDirTool.execute({ dir_path: 'nonexistent' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to list');
  });

  it('works with absolute path', async () => {
    await fs.writeFile(path.join(tmpDir, 'abs.txt'), 'content');
    const result = await listDirTool.execute({ dir_path: tmpDir }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('abs.txt');
  });
});
