import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/core/context-manager.js';

describe('ContextManager', () => {
  it('stores messages', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'system', content: 'You are helpful.' });
    cm.addMessage({ role: 'user', content: 'Hello!' });

    const msgs = cm.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('reports token estimate', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'Hello world' });

    const tokens = cm.getTokenEstimate();
    expect(tokens).toBeGreaterThan(0);
  });

  it('clears messages', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'Hello' });
    cm.addMessage({ role: 'assistant', content: 'Hi!' });

    cm.clear();
    expect(cm.getMessages()).toHaveLength(0);
    // estimateMessagesTokens adds 2 priming tokens even for empty arrays
    expect(cm.getTokenEstimate()).toBeLessThanOrEqual(2);
  });

  it('detects when compaction is needed', () => {
    const cm = new ContextManager('qwen3:8b');

    // Should not need compaction with small messages
    cm.addMessage({ role: 'user', content: 'Hello' });
    expect(cm.needsCompaction()).toBe(false);

    // Add a very large message to trigger compaction
    const bigContent = 'x'.repeat(500_000);
    cm.addMessage({ role: 'user', content: bigContent });
    expect(cm.needsCompaction()).toBe(true);
  });
});
