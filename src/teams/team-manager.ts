import type { LLMProvider } from '../llm/provider.js';
import type { ToolRegistry } from '../core/tool-registry.js';
import { TaskList } from './task-list.js';
import { MessageBus } from './message-bus.js';
import { Teammate, type TeammateCallbacks, type TeammateStatus } from './teammate.js';
import { saveTeamConfig, deleteTeamConfig, type TeamConfig, type TeammateConfig } from './team-config.js';
import { logger } from '../utils/logger.js';

export interface CreateTeamRequest {
  name: string;
  members: TeammateConfig[];
  tasks: Array<{
    title: string;
    description: string;
    assignee?: string;
    blockedBy?: string[];
  }>;
  displayMode?: 'in-process' | 'split-pane';
}

export interface TeamManagerCallbacks {
  onTeammateContent?: (teammate: string, content: string) => void;
  onTeammateToolCall?: (teammate: string, toolName: string, args: Record<string, unknown>) => void;
  onTeammateToolResult?: (teammate: string, toolName: string, result: { success: boolean; output: string }) => void;
  onTeammateStatusChange?: (teammate: string, status: TeammateStatus) => void;
  onTeammateTaskComplete?: (teammate: string, taskId: string) => void;
  onAllTasksComplete?: () => void;
  askUser?: (question: string) => Promise<string>;
}

export class TeamManager {
  private teammates = new Map<string, Teammate>();
  private taskList: TaskList | null = null;
  private messageBus = new MessageBus();
  private teamName: string | null = null;
  private teamConfig: TeamConfig | null = null;
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private cwd: string;
  private callbacks: TeamManagerCallbacks;
  private activeTeammateIndex = 0;

  constructor(opts: {
    provider: LLMProvider;
    toolRegistry: ToolRegistry;
    cwd: string;
    callbacks: TeamManagerCallbacks;
  }) {
    this.provider = opts.provider;
    this.toolRegistry = opts.toolRegistry;
    this.cwd = opts.cwd;
    this.callbacks = opts.callbacks;

    // Subscribe lead to messages
    this.messageBus.subscribe('lead', (msg) => {
      if (msg.type === 'idle') {
        logger.info(`Teammate ${msg.from} is idle`);
        this.checkAllComplete();
      }
      if (msg.type === 'task_update') {
        logger.info(`Task update from ${msg.from}: ${msg.content}`);
      }
    });
  }

  isActive(): boolean {
    return this.teamName !== null;
  }

  getTeamName(): string | null {
    return this.teamName;
  }

  async createTeam(request: CreateTeamRequest): Promise<void> {
    if (this.teamName) {
      throw new Error('A team is already active. Clean up first.');
    }

    this.teamName = request.name;
    this.taskList = new TaskList(request.name);

    // Create tasks
    const taskIdMap = new Map<string, string>(); // title -> id
    for (const taskDef of request.tasks) {
      const blockedByIds = (taskDef.blockedBy ?? [])
        .map((title) => taskIdMap.get(title))
        .filter(Boolean) as string[];
      const task = this.taskList.addTask(taskDef.title, taskDef.description, blockedByIds);
      taskIdMap.set(taskDef.title, task.id);

      if (taskDef.assignee) {
        this.taskList.assignTask(task.id, taskDef.assignee);
      }
    }
    await this.taskList.save();

    // Save team config
    this.teamConfig = {
      name: request.name,
      leadSessionId: 'current',
      members: request.members,
      createdAt: Date.now(),
      displayMode: request.displayMode ?? 'in-process',
    };
    await saveTeamConfig(this.teamConfig);

    // Create teammates
    for (const memberConfig of request.members) {
      const teammateCallbacks: TeammateCallbacks = {
        onContent: (name, content) => this.callbacks.onTeammateContent?.(name, content),
        onToolCall: (name, toolName, args) => this.callbacks.onTeammateToolCall?.(name, toolName, args),
        onToolResult: (name, toolName, result) => this.callbacks.onTeammateToolResult?.(name, toolName, result),
        onStatusChange: (name, status) => this.callbacks.onTeammateStatusChange?.(name, status),
        onTaskComplete: (name, taskId) => {
          this.callbacks.onTeammateTaskComplete?.(name, taskId);
          this.checkAllComplete();
        },
        askUser: this.callbacks.askUser,
      };

      const teammate = new Teammate({
        config: memberConfig,
        provider: this.provider,
        toolRegistry: this.toolRegistry,
        cwd: this.cwd,
        messageBus: this.messageBus,
        taskList: this.taskList,
        callbacks: teammateCallbacks,
      });

      this.teammates.set(memberConfig.name, teammate);
    }

    logger.info(`Team "${request.name}" created with ${request.members.length} teammates`);
  }

  async startTeam(): Promise<void> {
    if (!this.taskList) throw new Error('No team created');

    // Start all teammates - they will self-claim tasks
    const startPromises = Array.from(this.teammates.values()).map(async (teammate) => {
      const assignedTask = this.taskList!.getAllTasks().find(
        (t) => t.assignee === teammate.name && t.status === 'in_progress',
      );
      await teammate.start(assignedTask ?? undefined);
    });

    // Start all teammates concurrently
    await Promise.allSettled(startPromises);
  }

  async sendMessage(to: string, content: string): Promise<string> {
    const teammate = this.teammates.get(to);
    if (!teammate) {
      return `Teammate "${to}" not found. Available: ${Array.from(this.teammates.keys()).join(', ')}`;
    }

    this.messageBus.send('lead', to, content);
    return await teammate.sendMessage(content);
  }

  async broadcast(content: string): Promise<void> {
    this.messageBus.broadcast('lead', content);
    for (const [, teammate] of this.teammates) {
      if (teammate.getStatus() !== 'shutdown') {
        await teammate.sendMessage(`[Broadcast from lead]: ${content}`);
      }
    }
  }

  async shutdownTeammate(name: string): Promise<void> {
    const teammate = this.teammates.get(name);
    if (!teammate) return;

    this.messageBus.sendShutdown(name);
    teammate.shutdown();
    logger.info(`Teammate "${name}" shut down`);
  }

  async cleanup(): Promise<void> {
    // Shutdown all teammates
    for (const [name, teammate] of this.teammates) {
      if (teammate.getStatus() !== 'shutdown') {
        teammate.shutdown();
      }
    }

    // Clean up bus
    this.messageBus.clear();

    // Delete config
    if (this.teamName) {
      await deleteTeamConfig(this.teamName);
    }

    this.teammates.clear();
    this.taskList = null;
    this.teamName = null;
    this.teamConfig = null;

    logger.info('Team cleaned up');
  }

  // In-process navigation
  getTeammateNames(): string[] {
    return Array.from(this.teammates.keys());
  }

  getActiveTeammate(): Teammate | null {
    const names = this.getTeammateNames();
    if (names.length === 0) return null;
    return this.teammates.get(names[this.activeTeammateIndex]) ?? null;
  }

  selectNextTeammate(): string | null {
    const names = this.getTeammateNames();
    if (names.length === 0) return null;
    this.activeTeammateIndex = (this.activeTeammateIndex + 1) % names.length;
    return names[this.activeTeammateIndex];
  }

  selectPrevTeammate(): string | null {
    const names = this.getTeammateNames();
    if (names.length === 0) return null;
    this.activeTeammateIndex = (this.activeTeammateIndex - 1 + names.length) % names.length;
    return names[this.activeTeammateIndex];
  }

  selectTeammate(name: string): boolean {
    const names = this.getTeammateNames();
    const idx = names.indexOf(name);
    if (idx === -1) return false;
    this.activeTeammateIndex = idx;
    return true;
  }

  getTaskList(): TaskList | null {
    return this.taskList;
  }

  getTeamSummary(): string {
    const lines: string[] = [];
    lines.push(`=== Team: ${this.teamName} ===`);

    lines.push('\nTeammates:');
    for (const [, teammate] of this.teammates) {
      lines.push(`  ${teammate.toSummary()}`);
    }

    if (this.taskList) {
      lines.push(`\n${this.taskList.toSummary()}`);
    }

    return lines.join('\n');
  }

  private checkAllComplete(): void {
    if (this.taskList?.isAllComplete()) {
      logger.info('All tasks completed!');
      this.callbacks.onAllTasksComplete?.();
    }
  }
}
