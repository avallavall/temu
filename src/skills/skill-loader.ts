import fs from 'node:fs/promises';
import path from 'node:path';
import { TEMU_DIRS } from '../config/paths.js';
import { logger } from '../utils/logger.js';

export interface Skill {
  name: string;
  description: string;
  content: string;
  source: 'user' | 'project' | 'plugin';
  filePath: string;
}

// Parse frontmatter from SKILL.md files
// Format:
// ---
// description: short description
// ---
// body content
function parseFrontmatter(raw: string): { description: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { description: '', body: raw };

  const frontmatter = match[1];
  const body = match[2].trim();

  let description = '';
  for (const line of frontmatter.split('\n')) {
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) description = descMatch[1].trim();
  }

  return { description, body };
}

async function loadSkillsFromDir(dir: string, source: Skill['source']): Promise<Skill[]> {
  const skills: Skill[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Look for SKILL.md inside the directory
        const skillPath = path.join(dir, entry.name, 'SKILL.md');
        try {
          const content = await fs.readFile(skillPath, 'utf-8');
          const { description, body } = parseFrontmatter(content);
          skills.push({
            name: entry.name,
            description: description || `Skill: ${entry.name}`,
            content: body,
            source,
            filePath: skillPath,
          });
        } catch { /* no SKILL.md */ }
      } else if (entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
        // Top-level .md files as skills
        const skillPath = path.join(dir, entry.name);
        const content = await fs.readFile(skillPath, 'utf-8');
        const { description, body } = parseFrontmatter(content);
        const name = entry.name.replace(/\.md$/, '');
        skills.push({
          name,
          description: description || `Skill: ${name}`,
          content: body,
          source,
          filePath: skillPath,
        });
      }
    }
  } catch { /* dir doesn't exist */ }
  return skills;
}

export async function loadAllSkills(cwd: string): Promise<Skill[]> {
  const all: Skill[] = [];

  // User skills: ~/.temu/skills/
  const userSkillsDir = TEMU_DIRS.userSkills;
  all.push(...await loadSkillsFromDir(userSkillsDir, 'user'));

  // Project skills: .temu/skills/
  const projectSkillsDir = path.join(cwd, '.temu', 'skills');
  all.push(...await loadSkillsFromDir(projectSkillsDir, 'project'));

  logger.debug(`Loaded ${all.length} skills`);
  return all;
}

export function skillToPrompt(skill: Skill, userArgs: string): string {
  // Replace {{args}} placeholder with user arguments
  let prompt = skill.content;
  prompt = prompt.replace(/\{\{args\}\}/g, userArgs);
  prompt = prompt.replace(/\{\{input\}\}/g, userArgs);
  return prompt;
}
