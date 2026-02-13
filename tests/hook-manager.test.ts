import { describe, it, expect } from 'vitest';
import { HookManager } from '../src/hooks/hook-manager.js';

describe('HookManager', () => {
  it('starts with no hooks', () => {
    const hm = new HookManager();
    const hooks = hm.getHooksForEvent('SessionStart');
    expect(hooks).toHaveLength(0);
  });

  it('registers a single hook', () => {
    const hm = new HookManager();
    hm.register({ event: 'SessionStart', command: 'echo hello' });
    expect(hm.getHooksForEvent('SessionStart')).toHaveLength(1);
  });

  it('registers multiple hooks with registerAll', () => {
    const hm = new HookManager();
    hm.registerAll([
      { event: 'SessionStart', command: 'echo 1' },
      { event: 'PreToolUse', command: 'echo 2' },
    ]);
    expect(hm.getHooksForEvent('SessionStart')).toHaveLength(1);
    expect(hm.getHooksForEvent('PreToolUse')).toHaveLength(1);
  });

  it('filters hooks by event type', () => {
    const hm = new HookManager();
    hm.register({ event: 'SessionStart', command: 'echo start' });
    hm.register({ event: 'SessionEnd', command: 'echo end' });
    expect(hm.getHooksForEvent('SessionStart')).toHaveLength(1);
    expect(hm.getHooksForEvent('SessionEnd')).toHaveLength(1);
    expect(hm.getHooksForEvent('PreToolUse')).toHaveLength(0);
  });

  it('filters hooks by matcher pattern', () => {
    const hm = new HookManager();
    hm.register({ event: 'PreToolUse', command: 'echo bash', matcher: 'Bash' });
    hm.register({ event: 'PreToolUse', command: 'echo all' });

    // With toolName=Bash, both should match (one has matcher, one doesn't)
    expect(hm.getHooksForEvent('PreToolUse', 'Bash')).toHaveLength(2);
    // With toolName=Read, only the one without matcher should match
    expect(hm.getHooksForEvent('PreToolUse', 'Read')).toHaveLength(1);
  });

  it('supports wildcard matcher patterns', () => {
    const hm = new HookManager();
    hm.register({ event: 'PreToolUse', command: 'echo edit', matcher: '*Edit*' });

    expect(hm.getHooksForEvent('PreToolUse', 'Edit')).toHaveLength(1);
    expect(hm.getHooksForEvent('PreToolUse', 'MultiEdit')).toHaveLength(1);
    expect(hm.getHooksForEvent('PreToolUse', 'Read')).toHaveLength(0);
  });

  it('fire returns empty array when no hooks match', async () => {
    const hm = new HookManager();
    const results = await hm.fire({ event: 'SessionStart', timestamp: Date.now() });
    expect(results).toHaveLength(0);
  });

  it('fire executes matching hooks and returns results', async () => {
    const hm = new HookManager();
    const isWindows = process.platform === 'win32';
    const echoCmd = isWindows ? 'Write-Output "ok"' : 'echo ok';
    hm.register({ event: 'SessionStart', command: echoCmd, timeout: 5000 });

    const results = await hm.fire({ event: 'SessionStart', timestamp: Date.now() });
    expect(results).toHaveLength(1);
    expect(results[0].exitCode).toBe(0);
    expect(results[0].stdout).toContain('ok');
  });

  it('fire handles command errors gracefully', async () => {
    const hm = new HookManager();
    hm.register({ event: 'SessionStart', command: 'nonexistent_command_xyz', timeout: 3000 });

    const results = await hm.fire({ event: 'SessionStart', timestamp: Date.now() });
    expect(results).toHaveLength(1);
    // Should not throw, just return non-zero exit code
    expect(results[0].exitCode).not.toBe(0);
  });

  it('fire passes hook input as env variable', async () => {
    const hm = new HookManager();
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? 'Write-Output $env:TEMU_HOOK_EVENT'
      : 'echo $TEMU_HOOK_EVENT';
    hm.register({ event: 'SessionStart', command: cmd, timeout: 5000 });

    const results = await hm.fire({ event: 'SessionStart', timestamp: Date.now() });
    expect(results[0].stdout).toContain('SessionStart');
  });

  it('loadFromSettings handles missing file', async () => {
    const hm = new HookManager();
    await hm.loadFromSettings('/nonexistent/path/settings.json');
    expect(hm.getHooksForEvent('SessionStart')).toHaveLength(0);
  });

  it('multiple hooks for same event fire in order', async () => {
    const hm = new HookManager();
    const isWindows = process.platform === 'win32';
    hm.register({
      event: 'SessionStart',
      command: isWindows ? 'Write-Output "first"' : 'echo first',
      timeout: 5000,
    });
    hm.register({
      event: 'SessionStart',
      command: isWindows ? 'Write-Output "second"' : 'echo second',
      timeout: 5000,
    });

    const results = await hm.fire({ event: 'SessionStart', timestamp: Date.now() });
    expect(results).toHaveLength(2);
    expect(results[0].stdout).toContain('first');
    expect(results[1].stdout).toContain('second');
  });
});
