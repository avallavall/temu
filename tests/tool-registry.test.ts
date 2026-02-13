import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { createToolDef } from '../src/tools/types.js';

function makeTool(name: string) {
  return createToolDef(
    name,
    `Test tool ${name}`,
    { properties: { input: { type: 'string' } } },
    async () => ({ success: true, output: 'ok' }),
  );
}

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const reg = new ToolRegistry();
    const tool = makeTool('TestTool');
    reg.register(tool);

    expect(reg.get('TestTool')).toBe(tool);
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('lists tool names', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);

    expect(reg.names()).toEqual(['A', 'B', 'C']);
  });

  it('creates a subset', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);

    const sub = reg.subset(['A', 'C']);
    expect(sub.names()).toEqual(['A', 'C']);
    expect(sub.get('B')).toBeUndefined();
  });

  it('generates OpenAI tool format', () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('MyTool'));

    const openai = reg.toOpenAI();
    expect(openai).toHaveLength(1);
    expect(openai[0].type).toBe('function');
    expect(openai[0].function.name).toBe('MyTool');
  });
});
