import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

export interface LLMResponse {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMStreamChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: Partial<LLMToolCall>;
  finishReason?: string;
}

export interface LLMProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;

  chat(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    options?: Partial<LLMProviderConfig>,
  ): Promise<LLMResponse>;

  chatStream(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    options?: Partial<LLMProviderConfig>,
  ): AsyncGenerator<LLMStreamChunk>;

  listModels(): Promise<string[]>;
}
