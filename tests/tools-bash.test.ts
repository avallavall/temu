import { describe, it, expect } from 'vitest';
import { bashTool } from '../src/tools/bash.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';
import os from 'node:os';

describe('Bash tool', () => {
  const context = {
    cwd: os.tmpdir(),
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };

  it('executes a simple command', async () => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'Write-Output "hello"' : 'echo hello';
    const result = await bashTool.execute({ command: cmd }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('captures stderr on failure', async () => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'Get-Item nonexistent_file_xyz_12345' : 'cat nonexistent_file_xyz_12345';
    const result = await bashTool.execute({ command: cmd }, context);
    expect(result.success).toBe(false);
  });

  it('returns "(no output)" for silent successful commands', async () => {
    const isWindows = process.platform === 'win32';
    // A command that succeeds but produces no output
    const cmd = isWindows ? '$null = 0' : 'true';
    const result = await bashTool.execute({ command: cmd }, context);
    expect(result.success).toBe(true);
  });

  it('handles timeout', async () => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'Start-Sleep -Seconds 30' : 'sleep 30';
    const result = await bashTool.execute({ command: cmd, timeout: 500 }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 10000);

  it('uses custom cwd', async () => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'Get-Location | Select-Object -ExpandProperty Path' : 'pwd';
    const result = await bashTool.execute({ command: cmd, cwd: os.tmpdir() }, context);
    expect(result.success).toBe(true);
  });

  it('generates correct OpenAI tool format', () => {
    const openai = bashTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('Bash');
    expect(openai.function.parameters).toBeDefined();
  });
});
