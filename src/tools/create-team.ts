import { createToolDef } from './types.js';
import type { TeamManager, CreateTeamRequest } from '../teams/team-manager.js';
import type { TeammateConfig } from '../teams/team-config.js';
import { logger } from '../utils/logger.js';

export function createTeamTool(deps: {
  getTeamManager: () => TeamManager;
}) {
  return createToolDef(
    'CreateTeam',
    `Create and start an agent team for parallel work. Each teammate runs autonomously with their own agent loop, tools, and tasks. Use this when the user asks for multi-agent collaboration or when a task benefits from parallel execution by specialized agents.

Example usage:
{
  "name": "code-review-team",
  "members": [
    {"name": "security-reviewer", "role": "Security expert", "prompt": "Review code for security vulnerabilities", "tools": ["Read", "Grep", "Glob", "ListDir"], "permissionMode": "plan"},
    {"name": "perf-reviewer", "role": "Performance expert", "prompt": "Review code for performance issues", "tools": ["Read", "Grep", "Glob", "ListDir"], "permissionMode": "plan"}
  ],
  "tasks": [
    {"title": "Security audit", "description": "Check for SQL injection, XSS, auth issues", "assignee": "security-reviewer"},
    {"title": "Performance audit", "description": "Check for N+1 queries, memory leaks", "assignee": "perf-reviewer"}
  ]
}`,
    {
      required: ['name', 'members', 'tasks'],
      properties: {
        name: { type: 'string', description: 'Team name' },
        members: {
          type: 'array',
          description: 'Team members',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Unique teammate name (lowercase, no spaces)' },
              role: { type: 'string', description: 'Role description' },
              model: { type: 'string', description: 'Model to use (default: same as lead)' },
              prompt: { type: 'string', description: 'System prompt for this teammate' },
              tools: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tools available: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, ListDir',
              },
              permissionMode: { type: 'string', description: 'Permission mode: default, acceptEdits, plan, dontAsk, bypassPermissions' },
            },
          },
        },
        tasks: {
          type: 'array',
          description: 'Tasks to assign',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short task title' },
              description: { type: 'string', description: 'Detailed task description' },
              assignee: { type: 'string', description: 'Teammate name to assign to' },
              blockedBy: {
                type: 'array',
                items: { type: 'string' },
                description: 'Task titles this task depends on',
              },
            },
          },
        },
      },
    },
    async (args) => {
      const teamManager = deps.getTeamManager();

      if (teamManager.isActive()) {
        return { success: false, output: '', error: 'A team is already active. Use /team to see status.' };
      }

      const name = args.name as string;
      const rawMembers = (args.members as Record<string, unknown>[]) ?? [];
      const rawTasks = (args.tasks as Record<string, unknown>[]) ?? [];

      if (rawMembers.length === 0) {
        return { success: false, output: '', error: 'At least one team member is required.' };
      }
      if (rawTasks.length === 0) {
        return { success: false, output: '', error: 'At least one task is required.' };
      }

      const members: TeammateConfig[] = rawMembers.map((m) => ({
        name: (m.name as string) ?? 'agent',
        role: (m.role as string) ?? 'general',
        model: (m.model as string) ?? 'inherit',
        prompt: (m.prompt as string) ?? '',
        tools: (m.tools as string[]) ?? ['Read', 'Grep', 'Glob', 'ListDir'],
        permissionMode: (m.permissionMode as string) ?? 'dontAsk',
        requirePlanApproval: false,
      }));

      const tasks = rawTasks.map((t) => ({
        title: (t.title as string) ?? 'Untitled task',
        description: (t.description as string) ?? '',
        assignee: t.assignee as string | undefined,
        blockedBy: (t.blockedBy as string[]) ?? [],
      }));

      const request: CreateTeamRequest = {
        name,
        members,
        tasks,
        displayMode: 'in-process',
      };

      try {
        await teamManager.createTeam(request);
        await teamManager.startTeam();

        const memberNames = members.map((m) => m.name).join(', ');
        const taskTitles = tasks.map((t) => t.title).join(', ');
        logger.info(`Team "${name}" created and started`);

        return {
          success: true,
          output: `Team "${name}" created and started!\n\nMembers: ${memberNames}\nTasks: ${taskTitles}\n\nTeammates are now working autonomously. Use /team to check status, /tasks to see progress.`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, output: '', error: `Failed to create team: ${msg}` };
      }
    },
  );
}
