import { describe, it, expect } from 'vitest';
import { TaskList } from '../src/teams/task-list.js';

describe('TaskList - deep edge cases', () => {
  it('starts with empty list', () => {
    const tl = new TaskList('team-1');
    expect(tl.getAllTasks()).toHaveLength(0);
  });

  it('adds task with correct defaults', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('Build feature', 'Build the new feature');
    expect(task.title).toBe('Build feature');
    expect(task.description).toBe('Build the new feature');
    expect(task.status).toBe('pending');
    expect(task.assignee).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.blockedBy).toEqual([]);
  });

  it('getTask returns correct task', () => {
    const tl = new TaskList('team-1');
    const t1 = tl.addTask('Task A', 'Desc A');
    const t2 = tl.addTask('Task B', 'Desc B');
    expect(tl.getTask(t1.id)?.title).toBe('Task A');
    expect(tl.getTask(t2.id)?.title).toBe('Task B');
  });

  it('getTask returns undefined for non-existent id', () => {
    const tl = new TaskList('team-1');
    expect(tl.getTask('fake-id')).toBeUndefined();
  });

  it('assignTask sets assignee and status', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('Work item', 'Do work');
    const ok = tl.assignTask(task.id, 'alice');
    expect(ok).toBe(true);
    expect(tl.getTask(task.id)?.assignee).toBe('alice');
    expect(tl.getTask(task.id)?.status).toBe('in_progress');
  });

  it('assignTask returns false for non-pending task', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('Item', 'desc');
    tl.claimNextTask('alice'); // now in_progress
    const ok = tl.assignTask(task.id, 'bob');
    expect(ok).toBe(false);
  });

  it('claimNextTask assigns first pending task', () => {
    const tl = new TaskList('team-1');
    tl.addTask('First', 'desc1');
    tl.addTask('Second', 'desc2');
    const claimed = tl.claimNextTask('bob');
    expect(claimed).not.toBeNull();
    expect(claimed?.title).toBe('First');
    expect(claimed?.assignee).toBe('bob');
    expect(claimed?.status).toBe('in_progress');
  });

  it('claimNextTask returns null when all tasks assigned', () => {
    const tl = new TaskList('team-1');
    tl.addTask('Only task', 'desc');
    tl.claimNextTask('alice');
    const next = tl.claimNextTask('bob');
    expect(next).toBeNull();
  });

  it('claimNextTask returns null for empty list', () => {
    const tl = new TaskList('team-1');
    expect(tl.claimNextTask('alice')).toBeNull();
  });

  it('completeTask marks task as completed', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('Done item', 'desc');
    tl.completeTask(task.id);
    expect(tl.getTask(task.id)?.status).toBe('completed');
  });

  it('completeTask stores result', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('Item', 'desc');
    tl.completeTask(task.id, 'All done successfully');
    expect(tl.getTask(task.id)?.result).toBe('All done successfully');
  });

  it('completeTask returns false for non-existent task', () => {
    const tl = new TaskList('team-1');
    expect(tl.completeTask('fake-id')).toBe(false);
  });

  it('addTask with blockedBy creates blocked task', () => {
    const tl = new TaskList('team-1');
    const t1 = tl.addTask('First', 'desc');
    const t2 = tl.addTask('Second', 'depends on first', [t1.id]);
    expect(t2.status).toBe('blocked');
    expect(t2.blockedBy).toContain(t1.id);
  });

  it('completing a blocker unblocks dependent tasks', () => {
    const tl = new TaskList('team-1');
    const t1 = tl.addTask('Blocker', 'desc');
    const t2 = tl.addTask('Dependent', 'desc', [t1.id]);
    expect(t2.status).toBe('blocked');

    tl.completeTask(t1.id);
    // After completing blocker, dependent should become pending
    const updated = tl.getTask(t2.id);
    expect(updated?.status).toBe('pending');
  });

  it('getPendingTasks returns only pending unblocked tasks', () => {
    const tl = new TaskList('team-1');
    tl.addTask('pending1', 'desc');
    tl.addTask('pending2', 'desc');
    tl.claimNextTask('a'); // claims pending1
    const pending = tl.getPendingTasks();
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe('pending2');
  });

  it('getInProgressTasks returns only in-progress tasks', () => {
    const tl = new TaskList('team-1');
    tl.addTask('task1', 'desc');
    tl.addTask('task2', 'desc');
    tl.claimNextTask('alice');
    const inProgress = tl.getInProgressTasks();
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].assignee).toBe('alice');
  });

  it('getCompletedTasks returns only completed tasks', () => {
    const tl = new TaskList('team-1');
    const t = tl.addTask('done', 'desc');
    tl.completeTask(t.id);
    expect(tl.getCompletedTasks()).toHaveLength(1);
  });

  it('getTasksForAssignee filters by assignee', () => {
    const tl = new TaskList('team-1');
    tl.addTask('t1', 'd1');
    tl.addTask('t2', 'd2');
    tl.addTask('t3', 'd3');
    tl.claimNextTask('alice');
    tl.claimNextTask('bob');
    expect(tl.getTasksForAssignee('alice')).toHaveLength(1);
    expect(tl.getTasksForAssignee('bob')).toHaveLength(1);
    expect(tl.getTasksForAssignee('charlie')).toHaveLength(0);
  });

  it('isAllComplete returns true when all completed', () => {
    const tl = new TaskList('team-1');
    const t1 = tl.addTask('a', 'desc');
    const t2 = tl.addTask('b', 'desc');
    tl.completeTask(t1.id);
    tl.completeTask(t2.id);
    expect(tl.isAllComplete()).toBe(true);
  });

  it('isAllComplete returns false when tasks remain', () => {
    const tl = new TaskList('team-1');
    tl.addTask('a', 'desc');
    expect(tl.isAllComplete()).toBe(false);
  });

  it('isAllComplete returns true for empty list', () => {
    const tl = new TaskList('team-1');
    expect(tl.isAllComplete()).toBe(true);
  });

  it('hasPendingWork detects pending tasks', () => {
    const tl = new TaskList('team-1');
    expect(tl.hasPendingWork()).toBe(false);
    tl.addTask('work', 'desc');
    expect(tl.hasPendingWork()).toBe(true);
  });

  it('hasPendingWork detects in_progress tasks', () => {
    const tl = new TaskList('team-1');
    tl.addTask('work', 'desc');
    tl.claimNextTask('alice');
    expect(tl.hasPendingWork()).toBe(true);
  });

  it('toSummary produces formatted output', () => {
    const tl = new TaskList('team-1');
    tl.addTask('Task A', 'desc');
    const t2 = tl.addTask('Task B', 'desc');
    tl.completeTask(t2.id);
    const summary = tl.toSummary();
    expect(summary).toContain('Task A');
    expect(summary).toContain('Task B');
    expect(summary).toContain('⏳');
    expect(summary).toContain('✅');
    expect(summary).toContain('1/2 completed');
  });

  it('toSummary handles blocked tasks with emoji', () => {
    const tl = new TaskList('team-1');
    const t1 = tl.addTask('Blocker', 'desc');
    tl.addTask('Blocked', 'desc', [t1.id]);
    const summary = tl.toSummary();
    expect(summary).toContain('🚫');
  });

  it('toSummary handles in-progress tasks with emoji', () => {
    const tl = new TaskList('team-1');
    tl.addTask('Working', 'desc');
    tl.claimNextTask('alice');
    const summary = tl.toSummary();
    expect(summary).toContain('🔄');
    expect(summary).toContain('alice');
  });

  it('toSummary for empty list', () => {
    const tl = new TaskList('team-1');
    expect(tl.toSummary()).toBe('No tasks.');
  });

  it('multiple claims skip already-claimed tasks', () => {
    const tl = new TaskList('team-1');
    tl.addTask('first', 'desc');
    tl.addTask('second', 'desc');
    tl.addTask('third', 'desc');
    tl.claimNextTask('a');
    tl.claimNextTask('b');
    tl.claimNextTask('c');
    expect(tl.getPendingTasks()).toHaveLength(0);
    expect(tl.getInProgressTasks()).toHaveLength(3);
  });

  it('getAllTasks returns copy of all tasks', () => {
    const tl = new TaskList('team-1');
    tl.addTask('a', 'd');
    tl.addTask('b', 'd');
    const all = tl.getAllTasks();
    expect(all).toHaveLength(2);
    // Verify it's a copy
    all.push({} as any);
    expect(tl.getAllTasks()).toHaveLength(2);
  });

  it('tasks have timestamps', () => {
    const tl = new TaskList('team-1');
    const task = tl.addTask('test', 'desc');
    expect(task.createdAt).toBeGreaterThan(0);
    expect(task.updatedAt).toBeGreaterThan(0);
  });

  it('claimNextTask skips blocked tasks', () => {
    const tl = new TaskList('team-1');
    const blocker = tl.addTask('Blocker', 'desc');
    tl.addTask('Blocked', 'desc', [blocker.id]);
    tl.addTask('Free', 'desc');

    // First claim should get 'Blocker' (first pending unblocked)
    const first = tl.claimNextTask('a');
    expect(first?.title).toBe('Blocker');

    // Second claim should get 'Free' (Blocked is still blocked)
    const second = tl.claimNextTask('b');
    expect(second?.title).toBe('Free');
  });
});
