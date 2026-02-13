import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeTool } from '../src/tools/write.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('Write tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-write-'));
    context.cwd = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a new file', async () => {
    const result = await writeTool.execute({ file_path: 'new.txt', content: 'hello world' }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Created');
    const content = await fs.readFile(path.join(tmpDir, 'new.txt'), 'utf-8');
    expect(content).toBe('hello world');
  });

  it('creates parent directories automatically', async () => {
    const result = await writeTool.execute({
      file_path: 'deep/nested/dir/file.txt',
      content: 'nested',
    }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'deep/nested/dir/file.txt'), 'utf-8');
    expect(content).toBe('nested');
  });

  it('fails if file already exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'existing.txt'), 'old');
    const result = await writeTool.execute({ file_path: 'existing.txt', content: 'new' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('reports line count and char count', async () => {
    const result = await writeTool.execute({
      file_path: 'multi.txt',
      content: 'line1\nline2\nline3',
    }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('3 lines');
  });

  it('creates empty file', async () => {
    const result = await writeTool.execute({ file_path: 'empty.txt', content: '' }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'empty.txt'), 'utf-8');
    expect(content).toBe('');
  });

  it('handles special characters in content', async () => {
    const special = 'line with "quotes" and \'apostrophes\' and\ttabs';
    const result = await writeTool.execute({ file_path: 'special.txt', content: special }, context);
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, 'special.txt'), 'utf-8');
    expect(content).toBe(special);
  });

  it('generates correct OpenAI tool format', () => {
    const openai = writeTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('Write');
  });
});
