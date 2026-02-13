import { describe, it, expect } from 'vitest';
import { askUserTool } from '../src/tools/ask-user.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';

describe('AskUser tool', () => {
  it('returns user response', async () => {
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('bypassPermissions'),
      askUser: async (q: string) => `Answer to: ${q}`,
    };
    const result = await askUserTool.execute({ question: 'What color?' }, context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Answer to: What color?');
  });

  it('handles askUser rejection', async () => {
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('bypassPermissions'),
      askUser: async () => { throw new Error('stdin closed'); },
    };
    const result = await askUserTool.execute({ question: 'test' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to get user input');
  });

  it('passes question text correctly', async () => {
    let capturedQuestion = '';
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('bypassPermissions'),
      askUser: async (q: string) => { capturedQuestion = q; return 'yes'; },
    };
    await askUserTool.execute({ question: 'Continue?' }, context);
    expect(capturedQuestion).toBe('Continue?');
  });

  it('generates correct OpenAI tool format', () => {
    const openai = askUserTool.toOpenAI();
    expect(openai.type).toBe('function');
    expect(openai.function.name).toBe('AskUser');
    expect(openai.function.parameters).toHaveProperty('properties');
  });
});
