import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/utils/markdown.js';

describe('renderMarkdown', () => {
  it('renders plain text unchanged', () => {
    const result = renderMarkdown('hello world');
    expect(result).toContain('hello world');
  });

  it('renders h1 headers', () => {
    const result = renderMarkdown('# Title');
    expect(result).toContain('Title');
    expect(result).not.toContain('# ');
  });

  it('renders h2 headers', () => {
    const result = renderMarkdown('## Subtitle');
    expect(result).toContain('Subtitle');
  });

  it('renders h3 headers', () => {
    const result = renderMarkdown('### Section');
    expect(result).toContain('Section');
  });

  it('renders code blocks', () => {
    const input = '```typescript\nconst x = 1;\n```';
    const result = renderMarkdown(input);
    expect(result).toContain('const x = 1;');
    expect(result).toContain('typescript');
  });

  it('renders code blocks without language', () => {
    const input = '```\nsome code\n```';
    const result = renderMarkdown(input);
    expect(result).toContain('some code');
    expect(result).toContain('code');
  });

  it('renders inline code', () => {
    const result = renderMarkdown('Use `console.log` here');
    expect(result).toContain('console.log');
  });

  it('renders bold text', () => {
    const result = renderMarkdown('This is **bold** text');
    expect(result).toContain('bold');
  });

  it('renders italic text', () => {
    const result = renderMarkdown('This is *italic* text');
    expect(result).toContain('italic');
  });

  it('renders list items', () => {
    const result = renderMarkdown('- item one\n- item two');
    expect(result).toContain('item one');
    expect(result).toContain('item two');
  });

  it('renders list items with asterisks', () => {
    const result = renderMarkdown('* first\n* second');
    expect(result).toContain('first');
    expect(result).toContain('second');
  });

  it('handles empty string', () => {
    const result = renderMarkdown('');
    expect(result).toBe('');
  });

  it('handles multi-line mixed content', () => {
    const input = '# Title\n\nSome **bold** text.\n\n```js\nconst x = 1;\n```\n\n- item';
    const result = renderMarkdown(input);
    expect(result).toContain('Title');
    expect(result).toContain('bold');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('item');
  });

  it('handles nested formatting in same line', () => {
    const result = renderMarkdown('Use **`code`** here');
    expect(result).toContain('code');
  });

  it('handles indented list items', () => {
    const result = renderMarkdown('  - nested item');
    expect(result).toContain('nested item');
  });
});
