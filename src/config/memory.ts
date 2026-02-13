import fs from 'node:fs/promises';
import path from 'node:path';
import { projectMemory } from './paths.js';
import { logger } from '../utils/logger.js';

export async function loadProjectMemory(cwd: string): Promise<string> {
  const memoryPath = projectMemory(cwd);
  try {
    const content = await fs.readFile(memoryPath, 'utf-8');
    logger.debug(`Loaded TEMU.md from ${memoryPath} (${content.length} chars)`);
    return content;
  } catch {
    return '';
  }
}

export async function loadMemoryChain(cwd: string): Promise<string> {
  const memories: string[] = [];

  // Walk up from cwd to root looking for TEMU.md files
  let current = path.resolve(cwd);
  const visited = new Set<string>();

  while (!visited.has(current)) {
    visited.add(current);
    const temuMd = path.join(current, 'TEMU.md');
    try {
      const content = await fs.readFile(temuMd, 'utf-8');
      memories.unshift(content); // Parent memories first
    } catch {
      // No TEMU.md at this level
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Also load user-level memory
  const userMemory = path.join(
    (await import('./paths.js')).TEMU_DIRS.userHome,
    'TEMU.md'
  );
  try {
    const content = await fs.readFile(userMemory, 'utf-8');
    memories.unshift(content);
  } catch {
    // No user-level memory
  }

  return memories.join('\n\n---\n\n');
}
