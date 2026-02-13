import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  TEMU_DIRS,
  projectDir,
  projectSettings,
  projectMemory,
  projectAgents,
  projectSkills,
  teamConfigPath,
  taskListPath,
  sessionPath,
} from '../src/config/paths.js';

describe('TEMU_DIRS', () => {
  it('userHome is under home directory', () => {
    expect(TEMU_DIRS.userHome).toContain('.temu');
  });

  it('sessions dir is under userHome', () => {
    expect(TEMU_DIRS.sessions).toContain('.temu');
    expect(TEMU_DIRS.sessions).toContain('sessions');
  });

  it('all dirs are defined', () => {
    expect(TEMU_DIRS.userHome).toBeDefined();
    expect(TEMU_DIRS.userSettings).toBeDefined();
    expect(TEMU_DIRS.userAgents).toBeDefined();
    expect(TEMU_DIRS.userSkills).toBeDefined();
    expect(TEMU_DIRS.sessions).toBeDefined();
    expect(TEMU_DIRS.teams).toBeDefined();
    expect(TEMU_DIRS.tasks).toBeDefined();
    expect(TEMU_DIRS.logs).toBeDefined();
  });
});

describe('project path functions', () => {
  it('projectDir returns .temu under cwd', () => {
    const result = projectDir('/home/user/project');
    expect(result).toBe(path.join('/home/user/project', '.temu'));
  });

  it('projectSettings returns settings.json path', () => {
    const result = projectSettings('/home/user/project');
    expect(result).toContain('settings.json');
    expect(result).toContain('.temu');
  });

  it('projectMemory returns TEMU.md path', () => {
    const result = projectMemory('/home/user/project');
    expect(result).toContain('TEMU.md');
  });

  it('projectAgents returns agents path', () => {
    const result = projectAgents('/home/user/project');
    expect(result).toContain('agents');
  });

  it('projectSkills returns skills path', () => {
    const result = projectSkills('/home/user/project');
    expect(result).toContain('skills');
  });
});

describe('other path functions', () => {
  it('teamConfigPath includes team name', () => {
    const result = teamConfigPath('my-team');
    expect(result).toContain('my-team');
    expect(result).toContain('config.json');
  });

  it('taskListPath includes team name', () => {
    const result = taskListPath('my-team');
    expect(result).toContain('my-team');
  });

  it('sessionPath includes session id', () => {
    const result = sessionPath('abc-123');
    expect(result).toContain('abc-123');
    expect(result).toContain('.json');
  });
});
