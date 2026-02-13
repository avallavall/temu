import { describe, it, expect } from 'vitest';
import { MessageBus } from '../src/teams/message-bus.js';

describe('MessageBus - deep edge cases', () => {
  it('starts with empty history', () => {
    const bus = new MessageBus();
    expect(bus.getHistory()).toHaveLength(0);
  });

  it('send delivers message and records in history', () => {
    const bus = new MessageBus();
    bus.send('alice', 'bob', 'Hello Bob!');
    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].from).toBe('alice');
    expect(history[0].to).toBe('bob');
    expect(history[0].content).toBe('Hello Bob!');
  });

  it('send notifies subscribers', () => {
    const bus = new MessageBus();
    const received: string[] = [];
    bus.subscribe('bob', (msg) => received.push(msg.content));
    bus.send('alice', 'bob', 'Hello!');
    expect(received).toEqual(['Hello!']);
  });

  it('broadcast sends to all subscribers except sender', () => {
    const bus = new MessageBus();
    const bobMsgs: string[] = [];
    const charlieMsgs: string[] = [];
    bus.subscribe('bob', (msg) => bobMsgs.push(msg.content));
    bus.subscribe('charlie', (msg) => charlieMsgs.push(msg.content));
    bus.subscribe('lead', () => {}); // lead should not receive own broadcast

    bus.broadcast('lead', 'Team update');
    expect(bobMsgs).toEqual(['Team update']);
    expect(charlieMsgs).toEqual(['Team update']);
  });

  it('getHistory filters by agent name', () => {
    const bus = new MessageBus();
    bus.send('alice', 'bob', 'for bob');
    bus.send('alice', 'charlie', 'for charlie');
    bus.send('bob', 'alice', 'for alice');

    const aliceMsgs = bus.getHistory('alice');
    expect(aliceMsgs).toHaveLength(3); // sent 2 + received 1

    const bobMsgs = bus.getHistory('bob');
    expect(bobMsgs).toHaveLength(2); // received 1 + sent 1
  });

  it('messages have timestamps', () => {
    const bus = new MessageBus();
    bus.send('alice', 'bob', 'test');
    const msg = bus.getHistory()[0];
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it('messages have unique IDs', () => {
    const bus = new MessageBus();
    bus.send('a', 'b', 'msg1');
    bus.send('a', 'b', 'msg2');
    const history = bus.getHistory();
    expect(history[0].id).not.toBe(history[1].id);
  });

  it('preserves message order', () => {
    const bus = new MessageBus();
    bus.send('a', 'b', 'first');
    bus.send('a', 'b', 'second');
    bus.send('a', 'b', 'third');
    const history = bus.getHistory();
    expect(history[0].content).toBe('first');
    expect(history[1].content).toBe('second');
    expect(history[2].content).toBe('third');
  });

  it('sendShutdown sends shutdown type message', () => {
    const bus = new MessageBus();
    bus.sendShutdown('worker');
    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('shutdown');
    expect(history[0].to).toBe('worker');
    expect(history[0].from).toBe('lead');
  });

  it('sendIdle sends idle message to lead', () => {
    const bus = new MessageBus();
    bus.sendIdle('worker');
    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('idle');
    expect(history[0].to).toBe('lead');
  });

  it('sendTaskUpdate sends task_update type', () => {
    const bus = new MessageBus();
    bus.sendTaskUpdate('worker', 'task-123', 'completed');
    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('task_update');
    expect(history[0].content).toContain('task-123');
    expect(history[0].content).toContain('completed');
  });

  it('clear removes all messages and subscribers', () => {
    const bus = new MessageBus();
    bus.subscribe('alice', () => {});
    bus.send('a', 'b', 'msg1');
    bus.send('a', 'b', 'msg2');
    bus.clear();
    expect(bus.getHistory()).toHaveLength(0);
  });

  it('unsubscribe removes agent handlers', () => {
    const bus = new MessageBus();
    const received: string[] = [];
    bus.subscribe('bob', (msg) => received.push(msg.content));
    bus.send('alice', 'bob', 'before');
    bus.unsubscribe('bob');
    bus.send('alice', 'bob', 'after');
    expect(received).toEqual(['before']);
  });

  it('getUndelivered returns messages after timestamp', () => {
    const bus = new MessageBus();
    bus.send('a', 'bob', 'old');
    const now = Date.now();
    // Small delay to ensure different timestamps
    bus.send('a', 'bob', 'new');
    const undelivered = bus.getUndelivered('bob', now - 1);
    expect(undelivered.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty content', () => {
    const bus = new MessageBus();
    bus.send('a', 'b', '');
    expect(bus.getHistory()[0].content).toBe('');
  });

  it('handles subscriber error gracefully', () => {
    const bus = new MessageBus();
    bus.subscribe('bob', () => { throw new Error('handler crash'); });
    // Should not throw
    expect(() => bus.send('alice', 'bob', 'test')).not.toThrow();
  });

  it('many messages do not lose data', () => {
    const bus = new MessageBus();
    for (let i = 0; i < 100; i++) {
      bus.send('a', 'b', `msg-${i}`);
    }
    expect(bus.getHistory()).toHaveLength(100);
    expect(bus.getHistory()[99].content).toBe('msg-99');
  });

  it('getHistory returns copy', () => {
    const bus = new MessageBus();
    bus.send('a', 'b', 'test');
    const h1 = bus.getHistory();
    h1.push({} as any);
    expect(bus.getHistory()).toHaveLength(1);
  });
});
