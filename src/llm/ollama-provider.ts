import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { LLMProvider, LLMProviderConfig, LLMResponse, LLMStreamChunk, LLMToolCall } from './provider.js';
import { logger } from '../utils/logger.js';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultTopP: number;

  constructor(config: LLMProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'ollama',
    });
    this.defaultModel = config.model;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultTopP = config.topP ?? 0.9;
  }

  async chat(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    options?: Partial<LLMProviderConfig>,
  ): Promise<LLMResponse> {
    const model = options?.model ?? this.defaultModel;
    logger.debug(`LLM chat request: model=${model}, messages=${messages.length}, tools=${tools?.length ?? 0}`);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        temperature: options?.temperature ?? this.defaultTemperature,
        top_p: options?.topP ?? this.defaultTopP,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) throw new Error('No response from LLM');

      const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason ?? 'stop',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error('LLM chat error:', error);
      throw error;
    }
  }

  async *chatStream(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    options?: Partial<LLMProviderConfig>,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = options?.model ?? this.defaultModel;
    logger.debug(`LLM stream request: model=${model}, messages=${messages.length}`);

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      temperature: options?.temperature ?? this.defaultTemperature,
      top_p: options?.topP ?? this.defaultTopP,
      stream: true,
    });

    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'content', content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallAccumulator.has(idx)) {
            toolCallAccumulator.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
          }
          const acc = toolCallAccumulator.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason) {
        // Emit accumulated tool calls
        for (const [, acc] of toolCallAccumulator) {
          try {
            yield {
              type: 'tool_call',
              toolCall: {
                id: acc.id,
                name: acc.name,
                arguments: JSON.parse(acc.args || '{}'),
              },
            };
          } catch {
            logger.warn(`Failed to parse tool call args: ${acc.args}`);
          }
        }
        yield { type: 'done', finishReason };
      }
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data.map((m) => m.id);
    } catch (error) {
      logger.error('Failed to list models:', error);
      return [];
    }
  }
}
