import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const HOME = os.homedir();

export const TEMU_DIRS = {
  userHome: path.join(HOME, '.temu'),
  userSettings: path.join(HOME, '.temu', 'settings.json'),
  userAgents: path.join(HOME, '.temu', 'agents'),
  userSkills: path.join(HOME, '.temu', 'skills'),
  sessions: path.join(HOME, '.temu', 'sessions'),
  teams: path.join(HOME, '.temu', 'teams'),
  tasks: path.join(HOME, '.temu', 'tasks'),
  logs: path.join(HOME, '.temu', 'logs'),
} as const;

export function projectDir(cwd: string) {
  return path.join(cwd, '.temu');
}

export function projectSettings(cwd: string) {
  return path.join(cwd, '.temu', 'settings.json');
}

export function projectMemory(cwd: string) {
  return path.join(cwd, 'TEMU.md');
}

export function projectAgents(cwd: string) {
  return path.join(cwd, '.temu', 'agents');
}

export function projectSkills(cwd: string) {
  return path.join(cwd, '.temu', 'skills');
}

export function teamConfigPath(teamName: string) {
  return path.join(TEMU_DIRS.teams, teamName, 'config.json');
}

export function taskListPath(teamName: string) {
  return path.join(TEMU_DIRS.tasks, teamName);
}

export function sessionPath(sessionId: string) {
  return path.join(TEMU_DIRS.sessions, `${sessionId}.json`);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureTemuDirs(): Promise<void> {
  const dirs = [
    TEMU_DIRS.userHome,
    TEMU_DIRS.userAgents,
    TEMU_DIRS.userSkills,
    TEMU_DIRS.sessions,
    TEMU_DIRS.teams,
    TEMU_DIRS.tasks,
    TEMU_DIRS.logs,
  ];
  await Promise.all(dirs.map(ensureDir));
}
