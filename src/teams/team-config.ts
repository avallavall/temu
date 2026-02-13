import fs from 'node:fs/promises';
import { teamConfigPath, ensureDir } from '../config/paths.js';
import path from 'node:path';

export interface TeammateConfig {
  name: string;
  role: string;
  model: string;
  prompt: string;
  tools: string[];
  permissionMode: string;
  requirePlanApproval: boolean;
}

export interface TeamConfig {
  name: string;
  leadSessionId: string;
  members: TeammateConfig[];
  createdAt: number;
  displayMode: 'in-process' | 'split-pane';
}

export async function saveTeamConfig(config: TeamConfig): Promise<void> {
  const filePath = teamConfigPath(config.name);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function loadTeamConfig(teamName: string): Promise<TeamConfig | null> {
  try {
    const filePath = teamConfigPath(teamName);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as TeamConfig;
  } catch {
    return null;
  }
}

export async function deleteTeamConfig(teamName: string): Promise<void> {
  try {
    const filePath = teamConfigPath(teamName);
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
