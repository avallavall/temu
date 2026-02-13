import { describe, it, expect } from 'vitest';
import { BUILTIN_SUBAGENTS } from '../src/subagents/subagent-config.js';

describe('BUILTIN_SUBAGENTS', () => {
  it('has 5 built-in subagents', () => {
    expect(Object.keys(BUILTIN_SUBAGENTS)).toHaveLength(5);
  });

  it('includes researcher', () => {
    const r = BUILTIN_SUBAGENTS.researcher;
    expect(r).toBeDefined();
    expect(r.name).toBe('researcher');
    expect(r.tools).toContain('Read');
    expect(r.tools).not.toContain('Write');
    expect(r.permissionMode).toBe('plan');
  });

  it('includes reviewer', () => {
    const r = BUILTIN_SUBAGENTS.reviewer;
    expect(r).toBeDefined();
    expect(r.tools).toContain('Read');
    expect(r.tools).not.toContain('Edit');
  });

  it('includes tester', () => {
    const r = BUILTIN_SUBAGENTS.tester;
    expect(r).toBeDefined();
    expect(r.tools).toContain('Write');
    expect(r.tools).toContain('Bash');
  });

  it('includes fixer', () => {
    const r = BUILTIN_SUBAGENTS.fixer;
    expect(r).toBeDefined();
    expect(r.tools).toContain('Edit');
    expect(r.tools).toContain('MultiEdit');
  });

  it('includes documenter', () => {
    const r = BUILTIN_SUBAGENTS.documenter;
    expect(r).toBeDefined();
    expect(r.tools).toContain('Write');
  });

  it('all subagents have required fields', () => {
    for (const [key, config] of Object.entries(BUILTIN_SUBAGENTS)) {
      expect(config.name).toBe(key);
      expect(config.description).toBeTruthy();
      expect(config.systemPrompt).toBeTruthy();
      expect(config.tools).toBeDefined();
      expect(config.tools!.length).toBeGreaterThan(0);
    }
  });

  it('all subagents have maxTurns defined', () => {
    for (const config of Object.values(BUILTIN_SUBAGENTS)) {
      expect(config.maxTurns).toBeGreaterThan(0);
    }
  });
});
