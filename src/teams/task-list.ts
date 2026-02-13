import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { taskListPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string | null;
  blockedBy: string[];
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export class TaskList {
  private tasks: TaskItem[] = [];
  private teamName: string;
  private filePath: string;

  constructor(teamName: string) {
    this.teamName = teamName;
    this.filePath = path.join(taskListPath(teamName), 'tasks.json');
  }

  async load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.tasks = JSON.parse(content);
    } catch {
      this.tasks = [];
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.tasks, null, 2), 'utf-8');
  }

  addTask(title: string, description: string, blockedBy: string[] = []): TaskItem {
    const task: TaskItem = {
      id: uuidv4().slice(0, 8),
      title,
      description,
      status: blockedBy.length > 0 ? 'blocked' : 'pending',
      assignee: null,
      blockedBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.push(task);
    logger.debug(`Task added: ${task.id} - ${title}`);
    return task;
  }

  assignTask(taskId: string, assignee: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending') return false;
    task.assignee = assignee;
    task.status = 'in_progress';
    task.updatedAt = Date.now();
    return true;
  }

  claimNextTask(assignee: string): TaskItem | null {
    // Find the first pending, unblocked task
    const task = this.tasks.find(
      (t) => t.status === 'pending' && this.isUnblocked(t),
    );
    if (!task) return null;
    task.assignee = assignee;
    task.status = 'in_progress';
    task.updatedAt = Date.now();
    return task;
  }

  completeTask(taskId: string, result?: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.status = 'completed';
    task.result = result;
    task.updatedAt = Date.now();

    // Unblock dependent tasks
    this.updateBlockedTasks();
    return true;
  }

  getTask(taskId: string): TaskItem | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  getAllTasks(): TaskItem[] {
    return [...this.tasks];
  }

  getPendingTasks(): TaskItem[] {
    return this.tasks.filter((t) => t.status === 'pending' && this.isUnblocked(t));
  }

  getInProgressTasks(): TaskItem[] {
    return this.tasks.filter((t) => t.status === 'in_progress');
  }

  getCompletedTasks(): TaskItem[] {
    return this.tasks.filter((t) => t.status === 'completed');
  }

  getTasksForAssignee(assignee: string): TaskItem[] {
    return this.tasks.filter((t) => t.assignee === assignee);
  }

  isAllComplete(): boolean {
    return this.tasks.every((t) => t.status === 'completed');
  }

  hasPendingWork(): boolean {
    return this.tasks.some((t) => t.status === 'pending' || t.status === 'in_progress');
  }

  private isUnblocked(task: TaskItem): boolean {
    if (task.blockedBy.length === 0) return true;
    return task.blockedBy.every((depId) => {
      const dep = this.tasks.find((t) => t.id === depId);
      return dep?.status === 'completed';
    });
  }

  private updateBlockedTasks(): void {
    for (const task of this.tasks) {
      if (task.status === 'blocked' && this.isUnblocked(task)) {
        task.status = 'pending';
        task.updatedAt = Date.now();
      }
    }
  }

  toSummary(): string {
    if (this.tasks.length === 0) return 'No tasks.';
    const lines = this.tasks.map((t) => {
      const status = { pending: '⏳', in_progress: '🔄', completed: '✅', blocked: '🚫' }[t.status];
      const assignee = t.assignee ? ` [${t.assignee}]` : '';
      return `  ${status} ${t.id}: ${t.title}${assignee}`;
    });
    const completed = this.tasks.filter((t) => t.status === 'completed').length;
    lines.unshift(`Tasks: ${completed}/${this.tasks.length} completed`);
    return lines.join('\n');
  }
}
