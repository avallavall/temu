import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { LLMProvider } from '../llm/provider.js';
import { estimateMessagesTokens, getModelConfig } from '../llm/token-counter.js';
import { logger } from '../utils/logger.js';

export class ContextManager {
  private messages: ChatCompletionMessageParam[] = [];
  private model: string;
  private compactThresholdOverride?: number;

  constructor(model: string, compactThresholdOverride?: number) {
    this.model = model;
    this.compactThresholdOverride = compactThresholdOverride;
  }

  getMessages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  addMessage(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  addMessages(messages: ChatCompletionMessageParam[]): void {
    this.messages.push(...messages);
  }

  getTokenEstimate(): number {
    return estimateMessagesTokens(
      this.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : null,
      })),
    );
  }

  needsCompaction(): boolean {
    const config = getModelConfig(this.model);
    const threshold = this.compactThresholdOverride ?? config.compactThreshold;
    const currentTokens = this.getTokenEstimate();
    const limit = config.contextWindow * threshold;
    return currentTokens > limit;
  }

  async compact(provider: LLMProvider): Promise<void> {
    if (this.messages.length < 4) return;

    logger.info('Context compaction triggered...');
    const preTokens = this.getTokenEstimate();

    // Keep system message and last few messages
    const systemMsg = this.messages.find((m) => m.role === 'system');
    const recentMessages = this.messages.slice(-4);
    const middleMessages = this.messages.slice(
      systemMsg ? 1 : 0,
      this.messages.length - 4,
    );

    if (middleMessages.length === 0) return;

    // Build a summary of the middle conversation
    const summaryPrompt: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You are a conversation summarizer. Summarize the following conversation concisely, preserving all important technical details, decisions made, files modified, and current state. Be brief but complete.',
      },
      {
        role: 'user',
        content: middleMessages.map((m) => {
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return `[${m.role}]: ${content?.slice(0, 500) ?? '(empty)'}`;
        }).join('\n'),
      },
    ];

    try {
      const response = await provider.chat(summaryPrompt);
      const summary = response.content ?? 'Unable to summarize previous context.';

      // Rebuild messages: system + summary + recent
      this.messages = [];
      if (systemMsg) this.messages.push(systemMsg);
      this.messages.push({
        role: 'user',
        content: `[Previous conversation summary]: ${summary}`,
      });
      this.messages.push({
        role: 'assistant',
        content: 'I understand the context from our previous conversation. Let me continue from where we left off.',
      });
      this.messages.push(...recentMessages);

      const postTokens = this.getTokenEstimate();
      logger.info(`Compaction complete: ${preTokens} → ${postTokens} tokens`);
    } catch (error) {
      logger.error('Compaction failed:', error);
      // Fallback: just keep system + recent messages
      this.messages = [];
      if (systemMsg) this.messages.push(systemMsg);
      this.messages.push(...recentMessages);
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  clear(): void {
    this.messages = [];
  }

  messageCount(): number {
    return this.messages.length;
  }
}
