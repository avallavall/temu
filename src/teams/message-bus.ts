import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export type MessageType = 'message' | 'idle' | 'task_update' | 'shutdown' | 'broadcast';

export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: MessageType;
}

type MessageHandler = (message: TeamMessage) => void;

export class MessageBus {
  private subscribers = new Map<string, MessageHandler[]>();
  private history: TeamMessage[] = [];

  subscribe(agentName: string, handler: MessageHandler): void {
    const handlers = this.subscribers.get(agentName) ?? [];
    handlers.push(handler);
    this.subscribers.set(agentName, handlers);
  }

  unsubscribe(agentName: string): void {
    this.subscribers.delete(agentName);
  }

  send(from: string, to: string, content: string, type: MessageType = 'message'): TeamMessage {
    const msg: TeamMessage = {
      id: uuidv4().slice(0, 8),
      from,
      to,
      content,
      timestamp: Date.now(),
      type,
    };

    this.history.push(msg);
    logger.debug(`Message: ${from} → ${to} [${type}]: ${content.slice(0, 100)}`);

    // Deliver to recipient
    const handlers = this.subscribers.get(to) ?? [];
    for (const handler of handlers) {
      try {
        handler(msg);
      } catch (error) {
        logger.error(`Message delivery error for ${to}:`, error);
      }
    }

    return msg;
  }

  broadcast(from: string, content: string, type: MessageType = 'broadcast'): TeamMessage[] {
    const messages: TeamMessage[] = [];
    for (const [agentName] of this.subscribers) {
      if (agentName !== from) {
        messages.push(this.send(from, agentName, content, type));
      }
    }
    return messages;
  }

  sendIdle(from: string): TeamMessage {
    return this.send(from, 'lead', `Teammate "${from}" is now idle.`, 'idle');
  }

  sendShutdown(to: string): TeamMessage {
    return this.send('lead', to, 'Please shut down.', 'shutdown');
  }

  sendTaskUpdate(from: string, taskId: string, status: string): TeamMessage {
    return this.send(from, 'lead', `Task ${taskId} is now ${status}`, 'task_update');
  }

  getHistory(agentName?: string): TeamMessage[] {
    if (!agentName) return [...this.history];
    return this.history.filter((m) => m.from === agentName || m.to === agentName || m.to === 'all');
  }

  getUndelivered(agentName: string, since: number): TeamMessage[] {
    return this.history.filter(
      (m) => (m.to === agentName || m.to === 'all') && m.timestamp > since,
    );
  }

  clear(): void {
    this.history = [];
    this.subscribers.clear();
  }
}
