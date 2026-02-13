import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TEMU_DIRS, ensureDir } from '../config/paths.js';

export interface SessionData {
  id: string;
  name: string;
  cwd: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
}

export class SessionManager {
  private sessionsDir = TEMU_DIRS.sessions;

  async create(cwd: string, model: string): Promise<SessionData> {
    await ensureDir(this.sessionsDir);
    const session: SessionData = {
      id: uuidv4(),
      name: path.basename(cwd),
      cwd,
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
    };
    await this.save(session);
    return session;
  }

  async save(session: SessionData): Promise<void> {
    session.updatedAt = Date.now();
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  async load(sessionId: string): Promise<SessionData | null> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as SessionData;
    } catch {
      return null;
    }
  }

  async list(): Promise<SessionData[]> {
    try {
      await ensureDir(this.sessionsDir);
      const files = await fs.readdir(this.sessionsDir);
      const sessions: SessionData[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          sessions.push(JSON.parse(content));
        } catch { /* skip corrupt */ }
      }
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async getLatest(): Promise<SessionData | null> {
    const sessions = await this.list();
    return sessions[0] ?? null;
  }
}
