import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// We need to test loadSettings and saveUserSettings
// They depend on TEMU_DIRS, so we mock paths.js

let tmpDir: string;

vi.mock('../src/config/paths.js', async () => {
  const tmpBase = path.join(os.tmpdir(), `temu-test-settings-${Date.now()}`);
  await fs.mkdir(tmpBase, { recursive: true });
  return {
    TEMU_DIRS: {
      userHome: tmpBase,
      userSettings: path.join(tmpBase, 'settings.json'),
      userAgents: path.join(tmpBase, 'agents'),
      userSkills: path.join(tmpBase, 'skills'),
      sessions: path.join(tmpBase, 'sessions'),
      teams: path.join(tmpBase, 'teams'),
      tasks: path.join(tmpBase, 'tasks'),
      logs: path.join(tmpBase, 'logs'),
    },
    projectSettings: (cwd: string) => path.join(cwd, '.temu', 'settings.json'),
    projectDir: (cwd: string) => path.join(cwd, '.temu'),
    projectMemory: (cwd: string) => path.join(cwd, 'TEMU.md'),
    projectAgents: (cwd: string) => path.join(cwd, '.temu', 'agents'),
    projectSkills: (cwd: string) => path.join(cwd, '.temu', 'skills'),
    ensureDir: async (p: string) => fs.mkdir(p, { recursive: true }),
    ensureTemuDirs: async () => {},
    teamConfigPath: (name: string) => path.join(tmpBase, 'teams', name, 'config.json'),
    taskListPath: (name: string) => path.join(tmpBase, 'tasks', name),
    sessionPath: (id: string) => path.join(tmpBase, 'sessions', `${id}.json`),
  };
});

import { loadSettings, saveUserSettings } from '../src/config/settings.js';
import { TEMU_DIRS } from '../src/config/paths.js';

describe('loadSettings', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-settings-cwd-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns default settings when no config files exist', async () => {
    const settings = await loadSettings(tmpDir);
    expect(settings).toBeDefined();
    expect(settings.model).toBeDefined();
  });

  it('loads user settings from ~/.temu/settings.json', async () => {
    await fs.writeFile(TEMU_DIRS.userSettings, JSON.stringify({ model: 'custom-model' }));
    const settings = await loadSettings(tmpDir);
    expect(settings.model).toBe('custom-model');
  });

  it('loads project settings and overrides user settings', async () => {
    await fs.writeFile(TEMU_DIRS.userSettings, JSON.stringify({ model: 'user-model' }));
    const projDir = path.join(tmpDir, '.temu');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'settings.json'), JSON.stringify({ model: 'project-model' }));
    const settings = await loadSettings(tmpDir);
    expect(settings.model).toBe('project-model');
  });

  it('merges permissions additively', async () => {
    await fs.writeFile(TEMU_DIRS.userSettings, JSON.stringify({
      permissions: { allow: ['Bash(git *)'] },
    }));
    const projDir = path.join(tmpDir, '.temu');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(npm *)'] },
    }));
    const settings = await loadSettings(tmpDir);
    expect(settings.permissions?.allow).toContain('Bash(git *)');
    expect(settings.permissions?.allow).toContain('Bash(npm *)');
  });

  it('handles malformed JSON gracefully', async () => {
    await fs.writeFile(TEMU_DIRS.userSettings, 'NOT JSON');
    const settings = await loadSettings(tmpDir);
    expect(settings).toBeDefined();
  });
});

describe('saveUserSettings', () => {
  it('saves settings to user settings path', async () => {
    await saveUserSettings({ model: 'saved-model' } as any);
    const content = await fs.readFile(TEMU_DIRS.userSettings, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.model).toBe('saved-model');
  });
});
