import { describe, it, expect, vi } from 'vitest';
import { AgentLoop } from '../src/core/agent-loop.js';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';
import { createToolDef } from '../src/tools/types.js';
import type { LLMProvider, LLMResponse, LLMStreamChunk } from '../src/llm/provider.js';

function createMockProvider(responses: LLMResponse[]): LLMProvider {
  let callIndex = 0;
  return {
    name: 'mock',
    async chat() {
      if (callIndex >= responses.length) {
        return { content: 'Done', toolCalls: [], finishReason: 'stop' };
      }
      return responses[callIndex++];
    },
    async *chatStream(): AsyncGenerator<LLMStreamChunk> {
      yield { type: 'content', content: 'streamed' };
      yield { type: 'done', finishReason: 'stop' };
    },
    async listModels() { return ['mock-model']; },
  };
}

function createTestRegistry() {
  const reg = new ToolRegistry();
  reg.register(createToolDef('Echo', 'Echo input', {
    properties: { text: { type: 'string' } },
  }, async (args) => ({ success: true, output: args.text as string })));
  return reg;
}

function createTestContext() {
  return {
    cwd: '/tmp',
    permissions: new PermissionManager('bypassPermissions'),
    askUser: async () => 'y',
  };
}

describe('AgentLoop', () => {
  it('returns content from simple LLM response (no tool calls)', async () => {
    const provider = createMockProvider([
      { content: 'Hello!', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('Hi');
    expect(result.finalContent).toBe('Hello!');
    expect(result.turns).toBe(1);
    expect(result.aborted).toBe(false);
  });

  it('executes tool calls and continues', async () => {
    const provider = createMockProvider([
      {
        content: 'Let me echo that',
        toolCalls: [{ id: 'call-1', name: 'Echo', arguments: { text: 'echoed' } }],
        finishReason: 'tool_calls',
      },
      { content: 'Got the echo result', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('Echo something');
    expect(result.finalContent).toBe('Got the echo result');
    expect(result.turns).toBe(2);
  });

  it('respects maxTurns limit', async () => {
    // Provider always returns tool calls, never stops
    const provider = createMockProvider(
      Array(10).fill({
        content: 'more',
        toolCalls: [{ id: 'call-x', name: 'Echo', arguments: { text: 'loop' } }],
        finishReason: 'tool_calls',
      }),
    );
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      maxTurns: 3,
    });

    const result = await loop.run('Loop forever');
    expect(result.turns).toBe(3);
    expect(result.finalContent).toContain('Max turns reached');
  });

  it('abort stops the loop', async () => {
    let callCount = 0;
    const slowProvider: LLMProvider = {
      name: 'slow-mock',
      async chat() {
        callCount++;
        if (callCount === 1) {
          return {
            content: null,
            toolCalls: [{ id: 'call-1', name: 'Echo', arguments: { text: 'a' } }],
            finishReason: 'tool_calls',
          };
        }
        // Slow second call so abort has time
        await new Promise((r) => setTimeout(r, 200));
        return { content: 'should not reach', toolCalls: [], finishReason: 'stop' };
      },
      async *chatStream() { yield { type: 'done', finishReason: 'stop' }; },
      async listModels() { return []; },
    };
    const loop = new AgentLoop({
      provider: slowProvider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    // Abort shortly after first tool call completes
    setTimeout(() => loop.abort(), 50);
    const result = await loop.run('Start');
    expect(result.aborted).toBe(true);
  });

  it('handles LLM errors gracefully', async () => {
    const provider: LLMProvider = {
      name: 'error-mock',
      async chat() { throw new Error('LLM is down'); },
      async *chatStream() { throw new Error('stream fail'); },
      async listModels() { return []; },
    };
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('test');
    expect(result.finalContent).toContain('Error');
    expect(result.finalContent).toContain('LLM is down');
  });

  it('tracks token usage', async () => {
    const provider = createMockProvider([
      {
        content: 'Hi',
        toolCalls: [],
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('test');
    expect(result.totalTokens).toBe(15);
  });

  it('fires onContent callback', async () => {
    const contents: string[] = [];
    const provider = createMockProvider([
      { content: 'Hello world', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      onContent: (c) => contents.push(c),
    });

    await loop.run('test');
    expect(contents).toContain('Hello world');
  });

  it('fires onToolCall callback', async () => {
    const toolCalls: string[] = [];
    const provider = createMockProvider([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: 'Echo', arguments: { text: 'hi' } }],
        finishReason: 'tool_calls',
      },
      { content: 'Done', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      onToolCall: (name) => toolCalls.push(name),
    });

    await loop.run('test');
    expect(toolCalls).toContain('Echo');
  });

  it('fires onToolResult callback', async () => {
    const results: boolean[] = [];
    const provider = createMockProvider([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: 'Echo', arguments: { text: 'hi' } }],
        finishReason: 'tool_calls',
      },
      { content: 'Done', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      onToolResult: (_name, r) => results.push(r.success),
    });

    await loop.run('test');
    expect(results).toContain(true);
  });

  it('fires onTurnComplete callback', async () => {
    const turns: number[] = [];
    const provider = createMockProvider([
      { content: 'Done', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      onTurnComplete: (t) => turns.push(t),
    });

    await loop.run('test');
    expect(turns).toEqual([1]);
  });

  it('getContextManager returns context manager', () => {
    const provider = createMockProvider([]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });
    const cm = loop.getContextManager();
    expect(cm).toBeDefined();
    // System prompt should already be added
    expect(cm.messageCount()).toBeGreaterThan(0);
  });

  it('includes projectMemory in system prompt', () => {
    const provider = createMockProvider([]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      projectMemory: 'Use React with TypeScript',
    });
    const msgs = loop.getContextManager().getMessages();
    const systemMsg = msgs.find((m) => m.role === 'system');
    expect((systemMsg as any)?.content).toContain('React with TypeScript');
  });

  it('includes customInstructions in system prompt', () => {
    const provider = createMockProvider([]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
      customInstructions: 'Always use tabs',
    });
    const msgs = loop.getContextManager().getMessages();
    const systemMsg = msgs.find((m) => m.role === 'system');
    expect((systemMsg as any)?.content).toContain('Always use tabs');
  });

  it('runContinuation works from existing context', async () => {
    const provider = createMockProvider([
      { content: 'First', toolCalls: [], finishReason: 'stop' },
      { content: 'Continued', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    await loop.run('Start');
    const result = await loop.runContinuation();
    expect(result.finalContent).toBe('Continued');
  });

  it('handles unknown tool calls gracefully', async () => {
    const provider = createMockProvider([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: 'NonExistentTool', arguments: {} }],
        finishReason: 'tool_calls',
      },
      { content: 'Recovered', toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('test');
    // Should recover and continue
    expect(result.finalContent).toBe('Recovered');
    expect(result.turns).toBe(2);
  });

  it('handles response with no content and no tool calls', async () => {
    const provider = createMockProvider([
      { content: null, toolCalls: [], finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: createTestRegistry(),
      toolContext: createTestContext(),
      cwd: '/tmp',
      model: 'mock',
    });

    const result = await loop.run('test');
    expect(result.turns).toBe(1);
  });
});
