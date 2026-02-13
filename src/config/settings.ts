import fs from 'node:fs/promises';
import path from 'node:path';
import { TEMU_DIRS, projectSettings } from './paths.js';
import { logger } from '../utils/logger.js';
import type { HookConfig } from '../hooks/hook-manager.js';

export interface TemuSettings {
  model?: string;
  fallbackModel?: string;
  ollamaBaseUrl?: string;
  temperature?: number;
  topP?: number;
  numCtx?: number;
  maxTurns?: number;
  defaultMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions';
  teammateMode?: 'in-process' | 'auto';
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  hooks?: HookConfig[];
}

const DEFAULT_SETTINGS: TemuSettings = {
  model: 'qwen3:8b',
  ollamaBaseUrl: 'http://localhost:11434/v1',
  temperature: 0.7,
  topP: 0.9,
  maxTurns: 100,
  defaultMode: 'default',
  teammateMode: 'in-process',
};

async function loadJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function loadSettings(cwd: string): Promise<TemuSettings> {
  const userSettings = await loadJsonSafe<TemuSettings>(TEMU_DIRS.userSettings);
  const projSettings = await loadJsonSafe<TemuSettings>(projectSettings(cwd));

  // Allow alternate project config name: .temu/config.json (higher precedence than settings.json)
  const altProjectConfigPath = path.join(cwd, '.temu', 'config.json');
  const projAltSettings = await loadJsonSafe<TemuSettings>(altProjectConfigPath);

  // Local settings (not committed to git)
  const localPath = path.join(cwd, '.temu', 'settings.local.json');
  const localSettings = await loadJsonSafe<TemuSettings>(localPath);

  // Merge: defaults < user < project < local
  const merged: TemuSettings = {
    ...DEFAULT_SETTINGS,
    ...userSettings,
    ...projSettings,
    ...projAltSettings,
    ...localSettings,
  };

  // Merge permissions separately (additive)
  if (userSettings?.permissions || projSettings?.permissions || projAltSettings?.permissions || localSettings?.permissions) {
    merged.permissions = {
      allow: [
        ...(userSettings?.permissions?.allow ?? []),
        ...(projSettings?.permissions?.allow ?? []),
        ...(projAltSettings?.permissions?.allow ?? []),
        ...(localSettings?.permissions?.allow ?? []),
      ],
      deny: [
        ...(userSettings?.permissions?.deny ?? []),
        ...(projSettings?.permissions?.deny ?? []),
        ...(projAltSettings?.permissions?.deny ?? []),
        ...(localSettings?.permissions?.deny ?? []),
      ],
    };
  }

  // Merge hooks additively
  const allHooks = [
    ...(userSettings?.hooks ?? []),
    ...(projSettings?.hooks ?? []),
    ...(localSettings?.hooks ?? []),
  ];
  if (allHooks.length > 0) {
    merged.hooks = allHooks;
  }

  logger.debug('Loaded settings:', merged);
  return merged;
}

export async function saveUserSettings(settings: Partial<TemuSettings>): Promise<void> {
  const existing = await loadJsonSafe<TemuSettings>(TEMU_DIRS.userSettings) ?? {};
  const merged = { ...existing, ...settings };
  await fs.writeFile(TEMU_DIRS.userSettings, JSON.stringify(merged, null, 2), 'utf-8');
}
