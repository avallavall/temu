// Simple token estimation for context management.
// Uses the ~4 chars per token heuristic. Good enough for local models
// where we don't have access to the actual tokenizer.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content?: string | null }>,
): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // message overhead
    total += estimateTokens(msg.role);
    if (msg.content) {
      total += estimateTokens(msg.content);
    }
  }
  total += 2; // priming tokens
  return total;
}

export interface ModelContextConfig {
  name: string;
  contextWindow: number;
  compactThreshold: number; // percentage (0-1) at which to trigger compaction
}

const MODEL_CONFIGS: Record<string, ModelContextConfig> = {
  'qwen3:8b': { name: 'qwen3:8b', contextWindow: 32768, compactThreshold: 0.8 },
  'qwen3:14b': { name: 'qwen3:14b', contextWindow: 32768, compactThreshold: 0.8 },
  'qwen3:32b': { name: 'qwen3:32b', contextWindow: 32768, compactThreshold: 0.8 },
  'qwen2.5-coder:7b': { name: 'qwen2.5-coder:7b', contextWindow: 32768, compactThreshold: 0.8 },
  'llama3.1:8b': { name: 'llama3.1:8b', contextWindow: 131072, compactThreshold: 0.8 },
  'llama3.1:70b': { name: 'llama3.1:70b', contextWindow: 131072, compactThreshold: 0.8 },
  'mistral:7b': { name: 'mistral:7b', contextWindow: 32768, compactThreshold: 0.8 },
};

const DEFAULT_CONFIG: ModelContextConfig = {
  name: 'default',
  contextWindow: 32768,
  compactThreshold: 0.8,
};

export function getModelConfig(model: string): ModelContextConfig {
  return MODEL_CONFIGS[model] ?? DEFAULT_CONFIG;
}
