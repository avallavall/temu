import type { LLMProvider } from '../llm/provider.js';
import type { ToolContext } from '../tools/types.js';
import { AgentLoop } from '../core/agent-loop.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { PermissionManager, type PermissionMode } from '../permissions/permission-manager.js';
import type { MessageBus, TeamMessage } from './message-bus.js';
import type { TaskList, TaskItem } from './task-list.js';
import type { TeammateConfig } from './team-config.js';
import { logger } from '../utils/logger.js';

export type TeammateStatus = 'idle' | 'working' | 'waiting' | 'shutdown';

export interface TeammateCallbacks {
  onContent?: (teammate: string, content: string) => void;
  onToolCall?: (teammate: string, name: string, args: Record<string, unknown>) => void;
  onToolResult?: (teammate: string, name: string, result: { success: boolean; output: string }) => void;
  onStatusChange?: (teammate: string, status: TeammateStatus) => void;
  onTaskComplete?: (teammate: string, taskId: string) => void;
  askUser?: (question: string) => Promise<string>;
}

export class Teammate {
  readonly name: string;
  readonly role: string;
  readonly model: string;

  private config: TeammateConfig;
  private provider: LLMProvider;
  private agentLoop: AgentLoop | null = null;
  private toolRegistry: ToolRegistry;
  private cwd: string;
  private messageBus: MessageBus;
  private taskList: TaskList;
  private callbacks: TeammateCallbacks;
  private status: TeammateStatus = 'idle';
  private currentTask: TaskItem | null = null;
  private pendingMessages: TeamMessage[] = [];
  private lastMessageCheck = 0;

  constructor(opts: {
    config: TeammateConfig;
    provider: LLMProvider;
    toolRegistry: ToolRegistry;
    cwd: string;
    messageBus: MessageBus;
    taskList: TaskList;
    callbacks: TeammateCallbacks;
  }) {
    this.config = opts.config;
    this.name = opts.config.name;
    this.role = opts.config.role;
    this.model = opts.config.model;
    this.provider = opts.provider;
    this.toolRegistry = opts.config.tools.length > 0
      ? opts.toolRegistry.subset(opts.config.tools)
      : opts.toolRegistry;
    this.cwd = opts.cwd;
    this.messageBus = opts.messageBus;
    this.taskList = opts.taskList;
    this.callbacks = opts.callbacks;

    // Subscribe to messages
    this.messageBus.subscribe(this.name, (msg) => {
      this.pendingMessages.push(msg);
    });
  }

  getStatus(): TeammateStatus {
    return this.status;
  }

  getCurrentTask(): TaskItem | null {
    return this.currentTask;
  }

  private setStatus(status: TeammateStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(this.name, status);
  }

  async start(initialTask?: TaskItem): Promise<void> {
    if (initialTask) {
      this.currentTask = initialTask;
    } else {
      // Try to claim a task
      this.currentTask = this.taskList.claimNextTask(this.name);
    }

    if (!this.currentTask) {
      this.setStatus('idle');
      this.messageBus.sendIdle(this.name);
      return;
    }

    await this.workOnTask(this.currentTask);
  }

  private async workOnTask(task: TaskItem): Promise<void> {
    this.setStatus('working');
    logger.agent(this.name, `Working on task: ${task.title}`);

    const permManager = new PermissionManager(
      this.config.permissionMode as PermissionMode,
    );

    const toolContext: ToolContext = {
      cwd: this.cwd,
      permissions: permManager,
      askUser: this.callbacks.askUser ?? (async () => 'y'),
    };

    const taskListSummary = this.taskList.toSummary();

    const teammatePrompt = `You are "${this.name}", a teammate in an agent team.
Your role: ${this.role}

${this.config.prompt}

Current task list:
${taskListSummary}

Your assigned task:
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description}

Instructions:
- Complete the task described above
- Be thorough but focused on your specific task
- Do NOT modify files that other teammates are working on
- When done, summarize what you accomplished`;

    this.agentLoop = new AgentLoop({
      provider: this.provider,
      toolRegistry: this.toolRegistry,
      toolContext,
      cwd: this.cwd,
      model: this.model,
      customInstructions: teammatePrompt,
      maxTurns: 50,
      onContent: (content) => this.callbacks.onContent?.(this.name, content),
      onToolCall: (name, args) => this.callbacks.onToolCall?.(this.name, name, args),
      onToolResult: (name, result) => this.callbacks.onToolResult?.(this.name, name, result),
    });

    try {
      const result = await this.agentLoop.run(
        `Execute your assigned task: "${task.title}"\n\nDescription: ${task.description}`,
      );

      // Mark task complete
      this.taskList.completeTask(task.id, result.finalContent);
      await this.taskList.save();
      this.callbacks.onTaskComplete?.(this.name, task.id);
      this.messageBus.sendTaskUpdate(this.name, task.id, 'completed');

      logger.agent(this.name, `Completed task ${task.id} in ${result.turns} turns`);

      // Check for pending messages
      await this.processMessages();

      // Try to claim next task (self-claim)
      const nextTask = this.taskList.claimNextTask(this.name);
      if (nextTask) {
        this.currentTask = nextTask;
        await this.taskList.save();
        await this.workOnTask(nextTask);
      } else {
        this.currentTask = null;
        this.setStatus('idle');
        this.messageBus.sendIdle(this.name);
      }
    } catch (error) {
      logger.error(`Teammate ${this.name} error:`, error);
      this.setStatus('idle');
      this.messageBus.sendIdle(this.name);
    }
  }

  async sendMessage(content: string): Promise<string> {
    if (!this.agentLoop) {
      return 'Teammate is not currently running.';
    }

    // Inject message into the agent loop as a new user message
    const result = await this.agentLoop.run(
      `[Message from lead]: ${content}`,
    );
    return result.finalContent;
  }

  private async processMessages(): Promise<void> {
    while (this.pendingMessages.length > 0) {
      const msg = this.pendingMessages.shift()!;
      if (msg.type === 'shutdown') {
        this.shutdown();
        return;
      }
      if (msg.type === 'message' || msg.type === 'broadcast') {
        if (this.agentLoop) {
          await this.agentLoop.run(`[Message from ${msg.from}]: ${msg.content}`);
        }
      }
    }
  }

  shutdown(): void {
    logger.agent(this.name, 'Shutting down');
    if (this.agentLoop) {
      this.agentLoop.abort();
    }
    this.messageBus.unsubscribe(this.name);
    this.setStatus('shutdown');
  }

  toSummary(): string {
    const taskInfo = this.currentTask
      ? `working on "${this.currentTask.title}"`
      : 'no task assigned';
    return `[${this.name}] (${this.role}) - ${this.status} - ${taskInfo}`;
  }
}
