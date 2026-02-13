import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ToolDefinition } from '../tools/types.js';
import { logger } from '../utils/logger.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  toOpenAI(): ChatCompletionTool[] {
    return this.list().map((t) => t.toOpenAI());
  }

  subset(names: string[]): ToolRegistry {
    const sub = new ToolRegistry();
    for (const name of names) {
      const tool = this.tools.get(name);
      if (tool) sub.register(tool);
    }
    return sub;
  }

  without(names: string[]): ToolRegistry {
    const exclude = new Set(names);
    const sub = new ToolRegistry();
    for (const [name, tool] of this.tools) {
      if (!exclude.has(name)) sub.register(tool);
    }
    return sub;
  }
}
