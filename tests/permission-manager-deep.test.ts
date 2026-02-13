import { describe, it, expect } from 'vitest';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('PermissionManager - deep edge cases', () => {
  // Mode: acceptEdits
  describe('acceptEdits mode', () => {
    it('allows Edit without prompting', async () => {
      const pm = new PermissionManager('acceptEdits');
      const result = await pm.check('Edit', { file_path: 'test.ts' });
      expect(result).toEqual({ allowed: true });
    });

    it('allows MultiEdit without prompting', async () => {
      const pm = new PermissionManager('acceptEdits');
      const result = await pm.check('MultiEdit', { file_path: 'test.ts' });
      expect(result).toEqual({ allowed: true });
    });

    it('allows Write without prompting', async () => {
      const pm = new PermissionManager('acceptEdits');
      const result = await pm.check('Write', { file_path: 'test.ts' });
      expect(result).toEqual({ allowed: true });
    });

    it('requires approval for Bash', async () => {
      const pm = new PermissionManager('acceptEdits');
      const result = await pm.check('Bash', { command: 'ls' });
      expect('needsApproval' in result && result.needsApproval).toBe(true);
    });

    it('allows read tools without prompting', async () => {
      const pm = new PermissionManager('acceptEdits');
      const result = await pm.check('Read', { file_path: 'test.ts' });
      expect(result).toEqual({ allowed: true });
    });
  });

  // Mode: plan
  describe('plan mode', () => {
    it('denies Write', async () => {
      const pm = new PermissionManager('plan');
      const result = await pm.check('Write', {});
      expect('allowed' in result && !result.allowed).toBe(true);
    });

    it('denies Edit', async () => {
      const pm = new PermissionManager('plan');
      const result = await pm.check('Edit', {});
      expect('allowed' in result && !result.allowed).toBe(true);
    });

    it('denies Bash', async () => {
      const pm = new PermissionManager('plan');
      const result = await pm.check('Bash', {});
      expect('allowed' in result && !result.allowed).toBe(true);
    });

    it('allows Read in plan mode', async () => {
      const pm = new PermissionManager('plan');
      const result = await pm.check('Read', {});
      expect(result).toEqual({ allowed: true });
    });

    it('allows Grep in plan mode', async () => {
      const pm = new PermissionManager('plan');
      const result = await pm.check('Grep', {});
      expect(result).toEqual({ allowed: true });
    });
  });

  // Wildcard rules
  describe('wildcard matching', () => {
    it('allows Bash with git wildcard', async () => {
      const pm = new PermissionManager('default', ['Bash(git *)']);
      const result = await pm.check('Bash', { command: 'git status' });
      expect(result).toEqual({ allowed: true });
    });

    it('does not match non-matching wildcard', async () => {
      const pm = new PermissionManager('default', ['Bash(git *)']);
      const result = await pm.check('Bash', { command: 'rm -rf /' });
      expect('needsApproval' in result).toBe(true);
    });

    it('denies specific file paths', async () => {
      const pm = new PermissionManager('default', [], ['Edit(*.secret)']);
      const result = await pm.check('Edit', { file_path: 'keys.secret' });
      expect('allowed' in result && !result.allowed).toBe(true);
    });

    it('allow rule without specifier matches all', async () => {
      const pm = new PermissionManager('default', ['Bash']);
      const result = await pm.check('Bash', { command: 'anything' });
      expect(result).toEqual({ allowed: true });
    });
  });

  // setMode
  describe('setMode', () => {
    it('changes mode dynamically', async () => {
      const pm = new PermissionManager('default');
      pm.setMode('bypassPermissions');
      const result = await pm.check('Bash', { command: 'rm -rf /' });
      expect(result).toEqual({ allowed: true });
    });
  });

  // addAllowRule / addDenyRule
  describe('addAllowRule / addDenyRule', () => {
    it('addAllowRule permits previously blocked tool', async () => {
      const pm = new PermissionManager('default');
      pm.addAllowRule('Bash');
      const result = await pm.check('Bash', {});
      expect(result).toEqual({ allowed: true });
    });

    it('addDenyRule blocks previously allowed tool', async () => {
      const pm = new PermissionManager('dontAsk');
      pm.addDenyRule('Bash');
      const result = await pm.check('Bash', {});
      expect('allowed' in result && !result.allowed).toBe(true);
    });

    it('deny rules take precedence over allow rules', async () => {
      const pm = new PermissionManager('default', ['Bash'], ['Bash']);
      const result = await pm.check('Bash', {});
      // Deny is checked first
      expect('allowed' in result && !result.allowed).toBe(true);
    });
  });

  // allowForSession
  describe('allowForSession', () => {
    it('allows tool by name for session', async () => {
      const pm = new PermissionManager('default');
      pm.allowForSession('Bash');
      const result = await pm.check('Bash', { command: 'ls' });
      expect(result).toEqual({ allowed: true });
    });

    it('allows tool by key for session', async () => {
      const pm = new PermissionManager('default');
      pm.allowForSession('Bash(npm)');
      const result = await pm.check('Bash', { command: 'npm install' });
      expect(result).toEqual({ allowed: true });
    });
  });

  // describeToolCall (via needsApproval)
  describe('tool call descriptions', () => {
    it('describes Bash command', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('Bash', { command: 'npm test' });
      if ('needsApproval' in result) {
        expect(result.description).toContain('npm test');
      }
    });

    it('describes Edit with file path', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('Edit', { file_path: '/src/index.ts' });
      if ('needsApproval' in result) {
        expect(result.description).toContain('/src/index.ts');
      }
    });

    it('describes Write with file path', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('Write', { file_path: '/new-file.ts' });
      if ('needsApproval' in result) {
        expect(result.description).toContain('/new-file.ts');
      }
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('handles undefined args', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('Bash');
      // Should not crash
      expect(result).toBeDefined();
    });

    it('handles empty args', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('Bash', {});
      expect(result).toBeDefined();
    });

    it('handles unknown tool name', async () => {
      const pm = new PermissionManager('default');
      const result = await pm.check('UnknownTool', {});
      // Unknown tools are not in READ_TOOLS or WRITE_TOOLS, should be allowed
      expect(result).toEqual({ allowed: true });
    });

    it('handles malformed rule string', async () => {
      // Rule that doesn't match the expected pattern
      const pm = new PermissionManager('default', ['!!!invalid']);
      const result = await pm.check('Bash', {});
      // Should not crash, just not match
      expect(result).toBeDefined();
    });
  });
});
