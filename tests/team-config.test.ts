import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { saveTeamConfig, loadTeamConfig, deleteTeamConfig } from '../src/teams/team-config.js';

// These tests use the real paths module but test the file I/O logic
// We operate in the actual TEMU dirs (teams folder) which is safe
describe('TeamConfig', () => {
  const uniqueName = `test-team-${Date.now()}`;
  const deleteName = `delete-team-${Date.now()}`;

  it('saves and loads team config', async () => {
    const config: any = {
      name: uniqueName,
      leadSessionId: 'sess-1',
      members: [{ name: 'alice', role: 'coder', model: 'qwen3:8b', prompt: '', tools: [], permissionMode: 'default', requirePlanApproval: false }],
      createdAt: Date.now(),
      displayMode: 'in-process',
    };
    await saveTeamConfig(config);
    const loaded = await loadTeamConfig(uniqueName);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe(uniqueName);
    // Cleanup
    await deleteTeamConfig(uniqueName);
  });

  it('returns null for non-existent config', async () => {
    const loaded = await loadTeamConfig('nonexistent-team-xyz-999');
    expect(loaded).toBeNull();
  });

  it('deleteTeamConfig removes the config file', async () => {
    const config: any = {
      name: deleteName,
      leadSessionId: 'sess-2',
      members: [],
      createdAt: Date.now(),
      displayMode: 'in-process',
    };
    await saveTeamConfig(config);
    await deleteTeamConfig(deleteName);
    const loaded = await loadTeamConfig(deleteName);
    expect(loaded).toBeNull();
  });

  it('deleteTeamConfig handles non-existent config gracefully', async () => {
    await expect(deleteTeamConfig('nonexistent-xyz-999')).resolves.not.toThrow();
  });
});
