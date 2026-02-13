import { describe, it, expect, vi } from 'vitest';
import { MessageBus } from '../src/teams/message-bus.js';

describe('MessageBus', () => {
  it('delivers messages to subscribers', () => {
    const bus = new MessageBus();
    const handler = vi.fn();
    bus.subscribe('alice', handler);

    bus.send('bob', 'alice', 'hello');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'bob',
        to: 'alice',
        content: 'hello',
        type: 'message',
      }),
    );
  });

  it('broadcasts to all subscribers', () => {
    const bus = new MessageBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe('alice', h1);
    bus.subscribe('bob', h2);

    bus.broadcast('lead', 'attention everyone');

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('does not deliver to non-subscribers', () => {
    const bus = new MessageBus();
    const handler = vi.fn();
    bus.subscribe('alice', handler);

    bus.send('bob', 'charlie', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });

  it('stores message history', () => {
    const bus = new MessageBus();
    bus.subscribe('alice', () => {});

    bus.send('bob', 'alice', 'msg1');
    bus.send('bob', 'alice', 'msg2');

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
  });

  it('filters messages for a specific agent', () => {
    const bus = new MessageBus();
    bus.subscribe('alice', () => {});
    bus.subscribe('bob', () => {});

    bus.send('lead', 'alice', 'for alice');
    bus.send('lead', 'bob', 'for bob');

    const aliceMsgs = bus.getHistory('alice');
    expect(aliceMsgs).toHaveLength(1);
    expect(aliceMsgs[0].content).toBe('for alice');
  });

  it('sends shutdown messages', () => {
    const bus = new MessageBus();
    const handler = vi.fn();
    bus.subscribe('alice', handler);

    bus.sendShutdown('alice');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'shutdown' }),
    );
  });

  it('clears all state', () => {
    const bus = new MessageBus();
    bus.subscribe('alice', () => {});
    bus.send('bob', 'alice', 'hello');

    bus.clear();

    expect(bus.getHistory()).toHaveLength(0);
  });
});
