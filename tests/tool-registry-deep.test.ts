import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { createToolDef } from '../src/tools/types.js';

function makeTool(name: string) {
  return createToolDef(name, `Desc for ${name}`, { properties: {} }, async () => ({ success: true, output: 'ok' }));
}

describe('ToolRegistry - deep edge cases', () => {
  it('starts empty', () => {
    const reg = new ToolRegistry();
    expect(reg.list()).toHaveLength(0);
    expect(reg.names()).toHaveLength(0);
  });

  it('has() returns false for unregistered tool', () => {
    const reg = new ToolRegistry();
    expect(reg.has('NonExistent')).toBe(false);
  });

  it('get() returns undefined for unregistered tool', () => {
    const reg = new ToolRegistry();
    expect(reg.get('NonExistent')).toBeUndefined();
  });

  it('overwrites duplicate registration', () => {
    const reg = new ToolRegistry();
    const tool1 = makeTool('Read');
    const tool2 = createToolDef('Read', 'New desc', { properties: {} }, async () => ({ success: true, output: 'new' }));
    reg.register(tool1);
    reg.register(tool2);
    expect(reg.list()).toHaveLength(1);
    expect(reg.get('Read')!.description).toBe('New desc');
  });

  it('registerAll registers multiple at once', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);
    expect(reg.list()).toHaveLength(3);
    expect(reg.names()).toEqual(['A', 'B', 'C']);
  });

  it('subset returns only specified tools', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);
    const sub = reg.subset(['A', 'C']);
    expect(sub.names()).toEqual(['A', 'C']);
    expect(sub.has('B')).toBe(false);
  });

  it('subset ignores non-existent names', () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('A'));
    const sub = reg.subset(['A', 'NonExistent']);
    expect(sub.names()).toEqual(['A']);
  });

  it('subset with empty array returns empty registry', () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('A'));
    const sub = reg.subset([]);
    expect(sub.list()).toHaveLength(0);
  });

  it('without() excludes specified tools', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);
    const sub = reg.without(['B']);
    expect(sub.names()).toEqual(['A', 'C']);
  });

  it('without() with non-existent name returns all', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B')]);
    const sub = reg.without(['NonExistent']);
    expect(sub.names()).toEqual(['A', 'B']);
  });

  it('without() all names returns empty', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('A'), makeTool('B')]);
    const sub = reg.without(['A', 'B']);
    expect(sub.list()).toHaveLength(0);
  });

  it('toOpenAI() generates correct format for all tools', () => {
    const reg = new ToolRegistry();
    reg.registerAll([makeTool('Read'), makeTool('Write')]);
    const openai = reg.toOpenAI();
    expect(openai).toHaveLength(2);
    expect(openai[0].type).toBe('function');
    expect(openai[0].function.name).toBe('Read');
    expect(openai[1].function.name).toBe('Write');
  });

  it('toOpenAI() returns empty array for empty registry', () => {
    const reg = new ToolRegistry();
    expect(reg.toOpenAI()).toEqual([]);
  });

  it('modifications to subset do not affect parent', () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('A'));
    const sub = reg.subset(['A']);
    sub.register(makeTool('B'));
    expect(reg.has('B')).toBe(false);
    expect(sub.has('B')).toBe(true);
  });
});
