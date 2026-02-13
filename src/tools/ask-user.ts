import { createToolDef } from './types.js';

export const askUserTool = createToolDef(
  'AskUser',
  'Ask the user a question and wait for their response. Use when you need clarification or confirmation.',
  {
    required: ['question'],
    properties: {
      question: { type: 'string', description: 'The question to ask the user' },
    },
  },
  async (args, context) => {
    const question = args.question as string;
    try {
      const answer = await context.askUser(question);
      return { success: true, output: answer };
    } catch (error) {
      return { success: false, output: '', error: 'Failed to get user input' };
    }
  },
);
