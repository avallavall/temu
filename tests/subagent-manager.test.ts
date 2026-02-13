import { describe, it, expect } from 'vitest';
import { SubagentManager } from '../src/subagents/subagent-manager.js';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { createToolDef } from '../src/tools/types.js';
import type { LLMProvider, LLMStreamChunk } from '../src/llm/provider.js';

function createMockProvider(content: string = 'Subagent result'): LLMProvider {
  return {
    name: 'mock',
    async chat() {
      return { content, toolCalls: [], finishReason: 'stop' };
    },
    async *chatStream(): AsyncGenerator<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    async listModels() { return ['mock-model']; },
  };
}

function createTestRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(createToolDef('Read', 'Read files', { properties: {} }, async () => ({ success: true, output: 'content' })));
  reg.register(createToolDef('Grep', 'Search', { properties: {} }, async () => ({ success: true, output: 'found' })));
  reg.register(createToolDef('Glob', 'Find', { properties: {} }, async () => ({ success: true, output: 'files' })));
  reg.register(createToolDef('ListDir', 'List', { properties: {} }, async () => ({ success: true, output: 'dirs' })));
  reg.register(createToolDef('Bash', 'Shell', { properties: {} }, async () => ({ success: true, output: 'ok' })));
  return reg;
}

function makeMgr(provider?: LLMProvider) {
  return new SubagentManager({
    provider: provider ?? createMockProvider(),
    toolRegistry: createTestRegistry(),
    cwd: '/tmp',
    askUser: async () => 'y',
  });
}

describe('SubagentManager', () => {
  it('lists built-in subagent configs', () => {
    const mgr = makeMgr();
    const configs = mgr.listAvailable();
    expect(configs.length).toBeGreaterThanOrEqual(5);
    expect(configs.map((c: any) => c.name)).toContain('researcher');
    expect(configs.map((c: any) => c.name)).toContain('reviewer');
  });

  it('gets a specific config by name', () => {
    const mgr = makeMgr();
    const config = mgr.getConfig('researcher');
    expect(config).toBeDefined();
    expect(config!.name).toBe('researcher');
  });

  it('returns undefined for non-existent config', () => {
    const mgr = makeMgr();
    expect(mgr.getConfig('nonexistent')).toBeUndefined();
  });

  it('registers a custom config', () => {
    const mgr = makeMgr();
    mgr.registerConfig({
      name: 'custom',
      description: 'Custom agent',
      systemPrompt: 'You are custom',
      tools: ['Read'],
      maxTurns: 5,
    });
    const config = mgr.getConfig('custom');
    expect(config).toBeDefined();
    expect(config!.name).toBe('custom');
  });

  it('custom config appears in listAvailable', () => {
    const mgr = makeMgr();
    mgr.registerConfig({ name: 'myagent', description: 'Mine', systemPrompt: 'hi', tools: ['Read'], maxTurns: 5 });
    const names = mgr.listAvailable().map((c: any) => c.name);
    expect(names).toContain('myagent');
  });

  it('runs a built-in subagent and returns result', async () => {
    const mgr = makeMgr(createMockProvider('Research findings'));
    const result = await mgr.run('researcher', 'Find all TypeScript files');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Research findings');
    expect(result.name).toBe('researcher');
    expect(result.turns).toBeGreaterThan(0);
  });

  it('returns error result for non-existent agent name', async () => {
    const mgr = makeMgr();
    const result = await mgr.run('nonexistent', 'do something');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('abort returns false if agent not running', () => {
    const mgr = makeMgr();
    expect(mgr.abort('researcher')).toBe(false);
  });

  it('abortAll does not throw when nothing running', () => {
    const mgr = makeMgr();
    expect(() => mgr.abortAll()).not.toThrow();
  });

  it('isRunning returns false when idle', () => {
    const mgr = makeMgr();
    expect(mgr.isRunning('researcher')).toBe(false);
  });

  it('handles LLM error during subagent run', async () => {
    const errorProvider: LLMProvider = {
      name: 'error',
      async chat() { throw new Error('LLM crashed'); },
      async *chatStream() { throw new Error('fail'); },
      async listModels() { return []; },
    };
    const mgr = makeMgr(errorProvider);
    const result = await mgr.run('researcher', 'find files');
    // AgentLoop catches the error internally and returns it as finalContent
    expect(result.output).toContain('Error');
    expect(result.output).toContain('LLM crashed');
  });

  it('runs with inline SubagentConfig object', async () => {
    const mgr = makeMgr(createMockProvider('Inline done'));
    const result = await mgr.run({
      name: 'inline-agent',
      description: 'Inline test',
      systemPrompt: 'You are inline',
      tools: ['Read'],
      maxTurns: 3,
    }, 'do the thing');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Inline done');
  });

  it('fires onContent callback during run', async () => {
    const contents: string[] = [];
    const mgr = makeMgr(createMockProvider('Callback test'));
    await mgr.run('researcher', 'test', {
      onContent: (c) => contents.push(c),
    });
    expect(contents).toContain('Callback test');
  });
});
