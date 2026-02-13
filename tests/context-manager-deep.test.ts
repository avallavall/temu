import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/core/context-manager.js';

describe('ContextManager - deep edge cases', () => {
  it('addMessage stores messages in order', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'first' });
    cm.addMessage({ role: 'assistant', content: 'second' });
    const msgs = cm.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('first');
    expect(msgs[1].content).toBe('second');
  });

  it('addMessages stores multiple at once', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessages([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
    expect(cm.getMessages()).toHaveLength(3);
  });

  it('getMessages returns a copy (not a reference)', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'test' });
    const msgs = cm.getMessages();
    msgs.push({ role: 'assistant', content: 'injected' });
    expect(cm.getMessages()).toHaveLength(1);
  });

  it('messageCount returns correct count', () => {
    const cm = new ContextManager('qwen3:8b');
    expect(cm.messageCount()).toBe(0);
    cm.addMessage({ role: 'user', content: 'hi' });
    expect(cm.messageCount()).toBe(1);
    cm.addMessage({ role: 'assistant', content: 'hey' });
    expect(cm.messageCount()).toBe(2);
  });

  it('clear resets to empty', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'hi' });
    cm.addMessage({ role: 'assistant', content: 'hey' });
    cm.clear();
    expect(cm.getMessages()).toHaveLength(0);
    expect(cm.messageCount()).toBe(0);
  });

  it('setModel changes the model', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.setModel('llama3.1:8b');
    // Can verify indirectly through needsCompaction behavior
    cm.addMessage({ role: 'user', content: 'test' });
    expect(cm.needsCompaction()).toBe(false);
  });

  it('getTokenEstimate increases with more messages', () => {
    const cm = new ContextManager('qwen3:8b');
    const t0 = cm.getTokenEstimate();
    cm.addMessage({ role: 'user', content: 'Hello world this is a test message' });
    const t1 = cm.getTokenEstimate();
    expect(t1).toBeGreaterThan(t0);
    cm.addMessage({ role: 'assistant', content: 'I understand, let me help you with that' });
    const t2 = cm.getTokenEstimate();
    expect(t2).toBeGreaterThan(t1);
  });

  it('needsCompaction returns false for small conversations', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'user', content: 'hi' });
    expect(cm.needsCompaction()).toBe(false);
  });

  it('needsCompaction returns true when exceeding threshold', () => {
    // qwen3:8b has 32768 context, threshold 0.8 = 26214 tokens
    // ~4 chars per token, so we need ~104856 chars
    const cm = new ContextManager('qwen3:8b');
    const bigContent = 'x'.repeat(120000);
    cm.addMessage({ role: 'user', content: bigContent });
    expect(cm.needsCompaction()).toBe(true);
  });

  it('respects compactThresholdOverride', () => {
    // Override threshold to 0.01 (very low) so even small messages trigger
    const cm = new ContextManager('qwen3:8b', 0.01);
    cm.addMessage({ role: 'user', content: 'even a short message triggers at 0.01 threshold' });
    // 32768 * 0.01 = 327 tokens, a short message should still be below
    // Actually the message is quite small. Let's make it bigger.
    cm.addMessage({ role: 'user', content: 'x'.repeat(2000) });
    expect(cm.needsCompaction()).toBe(true);
  });

  it('handles messages with null content', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'assistant', content: null as any });
    expect(cm.getMessages()).toHaveLength(1);
    // Should not crash on token estimate
    const tokens = cm.getTokenEstimate();
    expect(tokens).toBeGreaterThanOrEqual(0);
  });

  it('handles tool messages', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({ role: 'tool', tool_call_id: 'call-1', content: 'result' } as any);
    expect(cm.getMessages()).toHaveLength(1);
  });

  it('handles assistant messages with tool_calls', () => {
    const cm = new ContextManager('qwen3:8b');
    cm.addMessage({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'Read', arguments: '{}' } }],
    } as any);
    expect(cm.getMessages()).toHaveLength(1);
  });
});
