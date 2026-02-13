import { describe, it, expect } from 'vitest';
import { TaskList } from '../src/teams/task-list.js';

describe('TaskList', () => {
  it('adds tasks with pending status', () => {
    const tl = new TaskList('test-team');
    const task = tl.addTask('Write tests', 'Add unit tests for core');

    expect(task.title).toBe('Write tests');
    expect(task.status).toBe('pending');
    expect(task.assignee).toBeNull();
  });

  it('assigns tasks', () => {
    const tl = new TaskList('test-team');
    const task = tl.addTask('Task 1', 'Desc');
    tl.assignTask(task.id, 'alice');

    const updated = tl.getTask(task.id);
    expect(updated?.assignee).toBe('alice');
    expect(updated?.status).toBe('in_progress');
  });

  it('claims next available task', () => {
    const tl = new TaskList('test-team');
    tl.addTask('Task A', 'Desc A');
    tl.addTask('Task B', 'Desc B');

    const claimed = tl.claimNextTask('bob');
    expect(claimed).not.toBeNull();
    expect(claimed?.assignee).toBe('bob');
    expect(claimed?.status).toBe('in_progress');
  });

  it('completes tasks', () => {
    const tl = new TaskList('test-team');
    const task = tl.addTask('Task', 'Desc');
    tl.assignTask(task.id, 'alice');
    tl.completeTask(task.id);

    expect(tl.getTask(task.id)?.status).toBe('completed');
  });

  it('respects blocking dependencies', () => {
    const tl = new TaskList('test-team');
    const t1 = tl.addTask('First', 'Do first');
    const t2 = tl.addTask('Second', 'Do second', [t1.id]);

    // t2 should be blocked, so claimNext returns t1
    const claimed = tl.claimNextTask('alice');
    expect(claimed?.id).toBe(t1.id);

    // t2 still blocked
    const claimed2 = tl.claimNextTask('bob');
    expect(claimed2).toBeNull();

    // Complete t1, now t2 is available
    tl.completeTask(t1.id);
    const claimed3 = tl.claimNextTask('bob');
    expect(claimed3?.id).toBe(t2.id);
  });

  it('detects all complete', () => {
    const tl = new TaskList('test-team');
    const t1 = tl.addTask('A', 'a');
    const t2 = tl.addTask('B', 'b');

    expect(tl.isAllComplete()).toBe(false);

    tl.assignTask(t1.id, 'x');
    tl.completeTask(t1.id);
    expect(tl.isAllComplete()).toBe(false);

    tl.assignTask(t2.id, 'y');
    tl.completeTask(t2.id);
    expect(tl.isAllComplete()).toBe(true);
  });

  it('generates summary', () => {
    const tl = new TaskList('test-team');
    tl.addTask('Task A', 'Desc A');
    tl.addTask('Task B', 'Desc B');

    const summary = tl.toSummary();
    expect(summary).toContain('Task A');
    expect(summary).toContain('Task B');
    expect(summary).toContain('⏳');
  });
});
