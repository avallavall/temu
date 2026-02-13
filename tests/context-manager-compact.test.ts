import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/core/context-manager.js';
import type { LLMProvider, LLMStreamChunk } from '../src/llm/provider.js';

function createMockProvider(summaryContent: string): LLMProvider {
  return {
    name: 'mock',
    async chat() {
      return { content: summaryContent, toolCalls: [], finishReason: 'stop' };
    },
    async *chatStream(): AsyncGenerator<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    async listModels() { return []; },
  };
}

describe('ContextManager.compact()', () => {
  it('compacts middle messages into a summary', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'You are TEMU' });
    cm.addMessage({ role: 'user', content: 'message 1' });
    cm.addMessage({ role: 'assistant', content: 'response 1' });
    cm.addMessage({ role: 'user', content: 'message 2' });
    cm.addMessage({ role: 'assistant', content: 'response 2' });
    cm.addMessage({ role: 'user', content: 'message 3' });
    cm.addMessage({ role: 'assistant', content: 'response 3' });
    cm.addMessage({ role: 'user', content: 'latest message' });
    cm.addMessage({ role: 'assistant', content: 'latest response' });

    expect(cm.messageCount()).toBe(9);

    const provider = createMockProvider('Summary of conversation so far');
    await cm.compact(provider);

    // Should have: system + summary_user + summary_assistant + last 4 messages
    const msgs = cm.getMessages();
    expect(msgs.length).toBeLessThan(9);
    expect(msgs[0].role).toBe('system');
    // Summary should be present
    const hasSummary = msgs.some((m) => typeof m.content === 'string' && m.content.includes('summary'));
    expect(hasSummary).toBe(true);
  });

  it('skips compaction if fewer than 4 messages', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'sys' });
    cm.addMessage({ role: 'user', content: 'hi' });
    cm.addMessage({ role: 'assistant', content: 'hey' });

    const provider = createMockProvider('should not be called');
    await cm.compact(provider);

    expect(cm.messageCount()).toBe(3);
  });

  it('skips compaction if no middle messages', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'sys' });
    cm.addMessage({ role: 'user', content: 'a' });
    cm.addMessage({ role: 'assistant', content: 'b' });
    cm.addMessage({ role: 'user', content: 'c' });
    cm.addMessage({ role: 'assistant', content: 'd' });

    const provider = createMockProvider('should not be called');
    await cm.compact(provider);

    // system + 4 recent = 5, no middle to compact
    expect(cm.messageCount()).toBe(5);
  });

  it('preserves system message after compaction', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'I am the system' });
    for (let i = 0; i < 10; i++) {
      cm.addMessage({ role: 'user', content: `msg ${i}` });
      cm.addMessage({ role: 'assistant', content: `resp ${i}` });
    }

    const provider = createMockProvider('Conversation summary');
    await cm.compact(provider);

    const msgs = cm.getMessages();
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toBe('I am the system');
  });

  it('preserves last 4 messages after compaction', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'sys' });
    for (let i = 0; i < 8; i++) {
      cm.addMessage({ role: 'user', content: `msg ${i}` });
    }

    const provider = createMockProvider('Summary');
    await cm.compact(provider);

    const msgs = cm.getMessages();
    // Last message should be the last one we added
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.content).toBe('msg 7');
  });

  it('handles LLM error during compaction (fallback)', async () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'sys' });
    for (let i = 0; i < 10; i++) {
      cm.addMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` });
    }

    const errorProvider: LLMProvider = {
      name: 'error',
      async chat() { throw new Error('LLM down'); },
      async *chatStream() { throw new Error('fail'); },
      async listModels() { return []; },
    };

    await cm.compact(errorProvider);

    // Fallback: system + last 4 messages
    const msgs = cm.getMessages();
    expect(msgs[0].role).toBe('system');
    expect(msgs.length).toBe(5); // system + 4 recent
  });

  it('works without system message', async () => {
    const cm = new ContextManager('qwen3:8b');
    for (let i = 0; i < 10; i++) {
      cm.addMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` });
    }

    const provider = createMockProvider('Summary');
    await cm.compact(provider);

    const msgs = cm.getMessages();
    // Should have summary + assistant ack + last 4
    expect(msgs.length).toBeLessThan(10);
  });
});
