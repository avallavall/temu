import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildToolResultMessage, buildUserMessage } from '../src/core/message-builder.js';

describe('buildSystemPrompt', () => {
  it('includes base prompt and cwd', () => {
    const msg = buildSystemPrompt({ cwd: '/home/user/project' });
    expect(msg.role).toBe('system');
    expect(msg.content).toContain('TEMU');
    expect(msg.content).toContain('/home/user/project');
  });

  it('includes platform info', () => {
    const msg = buildSystemPrompt({ cwd: '/tmp' });
    expect(msg.content).toContain('Platform:');
  });

  it('includes project memory when provided', () => {
    const msg = buildSystemPrompt({
      cwd: '/tmp',
      projectMemory: 'This project uses React and TypeScript',
    });
    expect(msg.content).toContain('Project Memory');
    expect(msg.content).toContain('React and TypeScript');
  });

  it('excludes project memory when not provided', () => {
    const msg = buildSystemPrompt({ cwd: '/tmp' });
    expect(msg.content).not.toContain('Project Memory');
  });

  it('includes custom instructions when provided', () => {
    const msg = buildSystemPrompt({
      cwd: '/tmp',
      customInstructions: 'Always use tabs for indentation',
    });
    expect(msg.content).toContain('Custom Instructions');
    expect(msg.content).toContain('tabs for indentation');
  });

  it('excludes custom instructions when not provided', () => {
    const msg = buildSystemPrompt({ cwd: '/tmp' });
    expect(msg.content).not.toContain('Custom Instructions');
  });

  it('includes both memory and custom instructions', () => {
    const msg = buildSystemPrompt({
      cwd: '/project',
      projectMemory: 'Memory content',
      customInstructions: 'Custom content',
    });
    expect(msg.content).toContain('Memory content');
    expect(msg.content).toContain('Custom content');
  });

  it('mentions core tool usage guidelines', () => {
    const msg = buildSystemPrompt({ cwd: '/tmp' });
    expect(msg.content).toContain('Read');
    expect(msg.content).toContain('Edit');
    expect(msg.content).toContain('Grep');
  });
});

describe('buildToolResultMessage', () => {
  it('builds success message', () => {
    const msg = buildToolResultMessage('call-123', {
      success: true,
      output: 'File contents here',
    });
    expect(msg.role).toBe('tool');
    expect((msg as any).tool_call_id).toBe('call-123');
    expect((msg as any).content).toBe('File contents here');
  });

  it('builds error message with error field', () => {
    const msg = buildToolResultMessage('call-456', {
      success: false,
      output: '',
      error: 'File not found',
    });
    expect((msg as any).content).toContain('Error: File not found');
  });

  it('builds error message with unknown error when no error field', () => {
    const msg = buildToolResultMessage('call-789', {
      success: false,
      output: 'some output',
    });
    expect((msg as any).content).toContain('Unknown error');
    expect((msg as any).content).toContain('some output');
  });

  it('truncates very large outputs to 50000 chars', () => {
    const largeOutput = 'x'.repeat(60000);
    const msg = buildToolResultMessage('call-big', {
      success: true,
      output: largeOutput,
    });
    expect((msg as any).content.length).toBeLessThanOrEqual(50000);
  });

  it('preserves empty output on success', () => {
    const msg = buildToolResultMessage('call-empty', {
      success: true,
      output: '',
    });
    expect((msg as any).content).toBe('');
  });
});

describe('buildUserMessage', () => {
  it('builds user message with content', () => {
    const msg = buildUserMessage('Hello there');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello there');
  });

  it('handles empty string', () => {
    const msg = buildUserMessage('');
    expect(msg.content).toBe('');
  });

  it('preserves special characters', () => {
    const msg = buildUserMessage('Hello\nWorld\t!');
    expect(msg.content).toBe('Hello\nWorld\t!');
  });
});
