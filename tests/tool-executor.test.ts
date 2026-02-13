import { describe, it, expect, vi } from 'vitest';
import { ToolExecutor } from '../src/core/tool-executor.js';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { PermissionManager } from '../src/permissions/permission-manager.js';
import { createToolDef } from '../src/tools/types.js';
import { HookManager } from '../src/hooks/hook-manager.js';

function makeTool(name: string, fn?: (args: Record<string, unknown>) => Promise<{ success: boolean; output: string; error?: string }>) {
  return createToolDef(
    name,
    `Test tool ${name}`,
    { properties: { input: { type: 'string' } } },
    fn ?? (async () => ({ success: true, output: 'ok' })),
  );
}

function makeContext(mode: 'bypassPermissions' | 'default' | 'plan' = 'bypassPermissions') {
  return {
    cwd: '/tmp',
    permissions: new PermissionManager(mode),
    askUser: async () => 'y',
  };
}

describe('ToolExecutor', () => {
  it('executes a known tool', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('TestTool'));
    const executor = new ToolExecutor(reg, makeContext());

    const result = await executor.execute({ id: 'call-1', name: 'TestTool', arguments: {} });
    expect(result.toolName).toBe('TestTool');
    expect(result.result.success).toBe(true);
    expect(result.result.output).toBe('ok');
  });

  it('returns error for unknown tool', async () => {
    const reg = new ToolRegistry();
    const executor = new ToolExecutor(reg, makeContext());

    const result = await executor.execute({ id: 'call-1', name: 'Unknown', arguments: {} });
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('Unknown tool');
  });

  it('lists available tools in error message', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Read'));
    reg.register(makeTool('Write'));
    const executor = new ToolExecutor(reg, makeContext());

    const result = await executor.execute({ id: 'call-1', name: 'Nope', arguments: {} });
    expect(result.result.error).toContain('Read');
    expect(result.result.error).toContain('Write');
  });

  it('catches tool execution errors', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Crasher', async () => { throw new Error('boom'); }));
    const executor = new ToolExecutor(reg, makeContext());

    const result = await executor.execute({ id: 'call-1', name: 'Crasher', arguments: {} });
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('boom');
  });

  it('denies tool in plan mode for write tools', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Write'));
    const context = makeContext('plan');
    const executor = new ToolExecutor(reg, context);

    const result = await executor.execute({ id: 'call-1', name: 'Write', arguments: {} });
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('Permission denied');
  });

  it('prompts user for approval in default mode and respects denial', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Bash'));
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('default'),
      askUser: async () => 'no',
    };
    const executor = new ToolExecutor(reg, context);

    const result = await executor.execute({ id: 'call-1', name: 'Bash', arguments: { command: 'rm -rf /' } });
    expect(result.result.success).toBe(false);
    expect(result.result.error).toContain('User denied');
  });

  it('prompts user for approval in default mode and respects approval', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Bash'));
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('default'),
      askUser: async () => 'y',
    };
    const executor = new ToolExecutor(reg, context);

    const result = await executor.execute({ id: 'call-1', name: 'Bash', arguments: {} });
    expect(result.result.success).toBe(true);
  });

  it('accepts "yes" as approval', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Bash'));
    const context = {
      cwd: '/tmp',
      permissions: new PermissionManager('default'),
      askUser: async () => 'yes',
    };
    const executor = new ToolExecutor(reg, context);

    const result = await executor.execute({ id: 'call-1', name: 'Bash', arguments: {} });
    expect(result.result.success).toBe(true);
  });

  it('fires PreToolUse hook', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('TestTool'));
    const hookManager = new HookManager();
    const fireSpy = vi.spyOn(hookManager, 'fire');
    const executor = new ToolExecutor(reg, makeContext(), hookManager);

    await executor.execute({ id: 'call-1', name: 'TestTool', arguments: {} });
    expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'PreToolUse' }));
  });

  it('fires PostToolUse hook on success', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('TestTool'));
    const hookManager = new HookManager();
    const fireSpy = vi.spyOn(hookManager, 'fire');
    const executor = new ToolExecutor(reg, makeContext(), hookManager);

    await executor.execute({ id: 'call-1', name: 'TestTool', arguments: {} });
    expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'PostToolUse' }));
  });

  it('fires PostToolUseFailure hook on error', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Crasher', async () => { throw new Error('fail'); }));
    const hookManager = new HookManager();
    const fireSpy = vi.spyOn(hookManager, 'fire');
    const executor = new ToolExecutor(reg, makeContext(), hookManager);

    await executor.execute({ id: 'call-1', name: 'Crasher', arguments: {} });
    expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'PostToolUseFailure' }));
  });

  it('executeAll runs multiple tools sequentially', async () => {
    const order: string[] = [];
    const reg = new ToolRegistry();
    reg.register(makeTool('A', async () => { order.push('A'); return { success: true, output: 'A' }; }));
    reg.register(makeTool('B', async () => { order.push('B'); return { success: true, output: 'B' }; }));
    const executor = new ToolExecutor(reg, makeContext());

    const results = await executor.executeAll([
      { id: '1', name: 'A', arguments: {} },
      { id: '2', name: 'B', arguments: {} },
    ]);
    expect(results).toHaveLength(2);
    expect(order).toEqual(['A', 'B']);
  });

  it('preserves toolCallId in result', async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool('Test'));
    const executor = new ToolExecutor(reg, makeContext());

    const result = await executor.execute({ id: 'my-call-id', name: 'Test', arguments: {} });
    expect(result.toolCallId).toBe('my-call-id');
  });
});
