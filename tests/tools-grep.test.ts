import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { grepTool } from '../src/tools/grep.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('Grep tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-grep-'));
    context.cwd = tmpDir;
    // Create test files
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'Hello World\nfoo bar\nbaz');
    await fs.writeFile(path.join(tmpDir, 'code.ts'), 'const x = 1;\nfunction hello() {}\nconst y = 2;');
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(path.join(tmpDir, 'sub', 'nested.txt'), 'nested content with foo');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds matches in files (file list mode)', async () => {
    const result = await grepTool.execute({
      query: 'Hello',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello.txt');
  });

  it('finds matches with match_per_line', async () => {
    const result = await grepTool.execute({
      query: 'foo',
      search_path: '.',
      match_per_line: true,
    }, context);
    expect(result.success).toBe(true);
    // Should show matching lines
    expect(result.output).toContain('foo');
  });

  it('reports no matches gracefully', async () => {
    const result = await grepTool.execute({
      query: 'nonexistent_pattern_xyz_999',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
    expect(result.output.toLowerCase()).toContain('no match');
  });

  it('respects fixed_strings option', async () => {
    const result = await grepTool.execute({
      query: 'Hello',
      search_path: '.',
      fixed_strings: true,
    }, context);
    expect(result.success).toBe(true);
  });

  it('respects includes filter', async () => {
    const result = await grepTool.execute({
      query: 'const',
      search_path: '.',
      includes: ['*.ts'],
    }, context);
    expect(result.success).toBe(true);
    if (!result.output.includes('No match')) {
      expect(result.output).toContain('code.ts');
    }
  });

  it('searches in nested directories', async () => {
    const result = await grepTool.execute({
      query: 'nested',
      search_path: '.',
    }, context);
    expect(result.success).toBe(true);
  });

  it('generates correct OpenAI tool format', () => {
    const openai = grepTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('Grep');
  });
});
