import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadProjectMemory, loadMemoryChain } from '../src/config/memory.js';

describe('loadProjectMemory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-memory-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads TEMU.md content', async () => {
    await fs.writeFile(path.join(tmpDir, 'TEMU.md'), 'Project uses React');
    const content = await loadProjectMemory(tmpDir);
    expect(content).toBe('Project uses React');
  });

  it('returns empty string when no TEMU.md exists', async () => {
    const content = await loadProjectMemory(tmpDir);
    expect(content).toBe('');
  });

  it('handles empty TEMU.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'TEMU.md'), '');
    const content = await loadProjectMemory(tmpDir);
    expect(content).toBe('');
  });
});

describe('loadMemoryChain', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-memchain-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty string when no TEMU.md files exist anywhere', async () => {
    const subDir = path.join(tmpDir, 'sub', 'deep');
    await fs.mkdir(subDir, { recursive: true });
    const content = await loadMemoryChain(subDir);
    // May contain user-level TEMU.md if it exists, but shouldn't crash
    expect(typeof content).toBe('string');
  });

  it('loads TEMU.md from cwd', async () => {
    await fs.writeFile(path.join(tmpDir, 'TEMU.md'), 'Project root memory');
    const content = await loadMemoryChain(tmpDir);
    expect(content).toContain('Project root memory');
  });

  it('loads TEMU.md from parent directories', async () => {
    await fs.writeFile(path.join(tmpDir, 'TEMU.md'), 'Parent memory');
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir);
    const content = await loadMemoryChain(subDir);
    expect(content).toContain('Parent memory');
  });

  it('combines multiple TEMU.md files (parent first)', async () => {
    await fs.writeFile(path.join(tmpDir, 'TEMU.md'), 'Root level');
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir);
    await fs.writeFile(path.join(subDir, 'TEMU.md'), 'Sub level');
    const content = await loadMemoryChain(subDir);
    expect(content).toContain('Root level');
    expect(content).toContain('Sub level');
    // Root should come before sub
    expect(content.indexOf('Root level')).toBeLessThan(content.indexOf('Sub level'));
  });
});
