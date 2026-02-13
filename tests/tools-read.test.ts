import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readTool } from '../src/tools/read.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('Read tool', () => {
  let tmpDir: string;
  const context = {
    cwd: '',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-read-'));
    context.cwd = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads a file with line numbers', async () => {
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'line1\nline2\nline3');
    const result = await readTool.execute({ file_path: 'test.txt' }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('line1');
    expect(result.output).toContain('line2');
    expect(result.output).toContain('line3');
  });

  it('applies offset parameter', async () => {
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'a\nb\nc\nd\ne');
    const result = await readTool.execute({ file_path: 'test.txt', offset: 3 }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('c');
    expect(result.output).not.toContain('\t' + 'a');
  });

  it('applies limit parameter', async () => {
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'a\nb\nc\nd\ne');
    const result = await readTool.execute({ file_path: 'test.txt', offset: 1, limit: 2 }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('a');
    expect(result.output).toContain('b');
    expect(result.output).not.toContain('\tc');
  });

  it('fails on non-existent file', async () => {
    const result = await readTool.execute({ file_path: 'nonexistent.txt' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read');
  });

  it('reads empty file', async () => {
    await fs.writeFile(path.join(tmpDir, 'empty.txt'), '');
    const result = await readTool.execute({ file_path: 'empty.txt' }, context);
    expect(result.success).toBe(true);
  });

  it('reads file with absolute path', async () => {
    const absPath = path.join(tmpDir, 'abs.txt');
    await fs.writeFile(absPath, 'content');
    const result = await readTool.execute({ file_path: absPath }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('content');
  });

  it('handles offset beyond file length', async () => {
    await fs.writeFile(path.join(tmpDir, 'short.txt'), 'only one line');
    const result = await readTool.execute({ file_path: 'short.txt', offset: 100 }, context);
    expect(result.success).toBe(true);
    // Should return empty or no lines
  });

  it('pads line numbers correctly', async () => {
    await fs.writeFile(path.join(tmpDir, 'numbered.txt'), 'a\nb');
    const result = await readTool.execute({ file_path: 'numbered.txt' }, context);
    expect(result.output).toMatch(/\d+\t/);
  });

  it('generates correct OpenAI tool format', () => {
    const openai = readTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('Read');
    expect(openai.function.parameters).toBeDefined();
  });
});
