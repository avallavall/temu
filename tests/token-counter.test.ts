import { describe, it, expect } from 'vitest';
import { estimateTokens, getModelConfig } from '../src/llm/token-counter.js';

describe('estimateTokens', () => {
  it('estimates tokens for a simple string', () => {
    const tokens = estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('estimates tokens for an empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('scales roughly with text length', () => {
    const short = estimateTokens('hello');
    const long = estimateTokens('hello '.repeat(100));
    expect(long).toBeGreaterThan(short);
  });

  it('estimates tokens for message arrays', () => {
    const msgs = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'Hello!' },
    ];
    const total = msgs.reduce((sum, m) => sum + estimateTokens(m.content ?? ''), 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('getModelConfig', () => {
  it('returns config for known model pattern', () => {
    const config = getModelConfig('qwen3:8b');
    expect(config).toHaveProperty('contextWindow');
    expect(config).toHaveProperty('compactThreshold');
    expect(config.contextWindow).toBeGreaterThan(0);
    expect(config.compactThreshold).toBeLessThan(config.contextWindow);
  });

  it('returns default config for unknown models', () => {
    const config = getModelConfig('unknown-model:latest');
    expect(config.contextWindow).toBeGreaterThan(0);
    expect(config.compactThreshold).toBeLessThan(config.contextWindow);
  });
});
