import { describe, it, expect } from 'vitest';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('PermissionManager', () => {
  it('allows everything in bypassPermissions mode', async () => {
    const pm = new PermissionManager('bypassPermissions');
    const result = await pm.check('Bash', { command: 'rm -rf /' });
    expect(result).toEqual({ allowed: true });
  });

  it('allows read-only tools in default mode', async () => {
    const pm = new PermissionManager('default');
    const result = await pm.check('Read', { file_path: '/foo.ts' });
    expect(result).toEqual({ allowed: true });
  });

  it('asks for write tools in default mode', async () => {
    const pm = new PermissionManager('default');
    const result = await pm.check('Write', { file_path: '/foo.ts' });
    expect(result).toHaveProperty('needsApproval', true);
  });

  it('allows explicitly allowed tools', async () => {
    const pm = new PermissionManager('default', ['Bash(git *)']);
    const result = await pm.check('Bash', { command: 'git status' });
    expect(result).toEqual({ allowed: true });
  });

  it('denies explicitly denied tools', async () => {
    const pm = new PermissionManager('default', [], ['Bash(rm *)']);
    const result = await pm.check('Bash', { command: 'rm -rf /' });
    expect(result).toHaveProperty('allowed', false);
  });

  it('allows everything in dontAsk mode', async () => {
    const pm = new PermissionManager('dontAsk');
    const result = await pm.check('Write', { file_path: '/foo.ts' });
    expect(result).toEqual({ allowed: true });
  });

  it('denies writes in plan mode', async () => {
    const pm = new PermissionManager('plan');
    const result = await pm.check('Write', { file_path: '/foo.ts' });
    expect(result).toHaveProperty('allowed', false);
  });
});
