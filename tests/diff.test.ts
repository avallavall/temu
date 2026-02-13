import { describe, it, expect } from 'vitest';
import { formatDiff } from '../src/utils/diff.js';

describe('formatDiff', () => {
  it('shows no changes for identical strings', () => {
    const result = formatDiff('hello', 'hello', 'test.txt');
    expect(result).toContain('hello');
    expect(result).toContain('test.txt');
  });

  it('shows additions in output', () => {
    const result = formatDiff('line1', 'line1\nline2', 'file.ts');
    expect(result).toContain('line2');
  });

  it('shows deletions in output', () => {
    const result = formatDiff('line1\nline2', 'line1', 'file.ts');
    expect(result).toContain('line2');
  });

  it('handles empty old string', () => {
    const result = formatDiff('', 'new content', 'file.ts');
    expect(result).toContain('new content');
  });

  it('handles empty new string', () => {
    const result = formatDiff('old content', '', 'file.ts');
    expect(result).toContain('old content');
  });

  it('handles both empty strings', () => {
    const result = formatDiff('', '', 'empty.ts');
    expect(result).toBeDefined();
    expect(result).toContain('empty.ts');
  });

  it('handles multi-line changes', () => {
    const old = 'line1\nline2\nline3';
    const newStr = 'line1\nmodified\nline3';
    const result = formatDiff(old, newStr, 'multi.ts');
    expect(result).toContain('line2');
    expect(result).toContain('modified');
  });

  it('handles special characters', () => {
    const result = formatDiff('foo(bar)', 'foo(baz)', 'special.ts');
    expect(result).toBeDefined();
  });

  it('includes file path in header', () => {
    const result = formatDiff('a', 'b', '/src/index.ts');
    expect(result).toContain('/src/index.ts');
  });

  it('handles context lines correctly', () => {
    const old = 'a\nb\nc\nd\ne';
    const newStr = 'a\nb\nX\nd\ne';
    const result = formatDiff(old, newStr, 'ctx.ts');
    // 'c' should be removed, 'X' should be added
    expect(result).toContain('c');
    expect(result).toContain('X');
  });
});
