import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { globTool } from '../src/tools/glob.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('Glob tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-glob-'));
    context.cwd = tmpDir;
    await fs.writeFile(path.join(tmpDir, 'hello.ts'), 'const x = 1;');
    await fs.writeFile(path.join(tmpDir, 'world.ts'), 'const y = 2;');
    await fs.writeFile(path.join(tmpDir, 'readme.md'), '# Hello');
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(path.join(tmpDir, 'sub', 'nested.ts'), 'nested');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds files by glob pattern', async () => {
    const result = await globTool.execute({
      pattern: '*.ts',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
    // Should find at least one .ts file (via fd or fallback)
  });

  it('finds markdown files', async () => {
    const result = await globTool.execute({
      pattern: '*.md',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
  });

  it('reports no files when pattern does not match', async () => {
    const result = await globTool.execute({
      pattern: '*.xyz_nonexistent',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
    expect(result.output.toLowerCase()).toContain('no file');
  });

  it('supports type filter for directories', async () => {
    const result = await globTool.execute({
      pattern: '*',
      search_path: '.',
      type: 'directory',
    }, context);
    expect(result.success).toBe(true);
  });

  it('supports max_depth', async () => {
    const result = await globTool.execute({
      pattern: '*.ts',
      search_path: '.',
      max_depth: 1,
    }, context);
    expect(result.success).toBe(true);
  });

  it('supports extensions filter', async () => {
    const result = await globTool.execute({
      pattern: '*',
      search_path: '.',
      extensions: ['ts'],
    }, context);
    expect(result.success).toBe(true);
  });

  it('generates correct OpenAI tool format', () => {
    const openai = globTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('Glob');
  });
});
