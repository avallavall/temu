import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadAllSkills, skillToPrompt } from '../src/skills/skill-loader.js';
import type { Skill } from '../src/skills/skill-loader.js';

describe('skillToPrompt', () => {
  const baseSkill: Skill = {
    name: 'deploy',
    description: 'Deploy app',
    content: 'Deploy to {{args}} environment',
    source: 'project',
    filePath: '/test/SKILL.md',
  };

  it('replaces {{args}} with user arguments', () => {
    const result = skillToPrompt(baseSkill, 'production');
    expect(result).toBe('Deploy to production environment');
  });

  it('replaces {{input}} with user arguments', () => {
    const skill = { ...baseSkill, content: 'Process {{input}} now' };
    const result = skillToPrompt(skill, 'data.csv');
    expect(result).toBe('Process data.csv now');
  });

  it('replaces multiple occurrences of {{args}}', () => {
    const skill = { ...baseSkill, content: '{{args}} and {{args}}' };
    const result = skillToPrompt(skill, 'test');
    expect(result).toBe('test and test');
  });

  it('returns content unchanged if no placeholders', () => {
    const skill = { ...baseSkill, content: 'No placeholders here' };
    const result = skillToPrompt(skill, 'ignored');
    expect(result).toBe('No placeholders here');
  });

  it('handles empty args', () => {
    const result = skillToPrompt(baseSkill, '');
    expect(result).toBe('Deploy to  environment');
  });

  it('handles args with special characters', () => {
    const skill = { ...baseSkill, content: 'Run {{args}}' };
    const result = skillToPrompt(skill, 'test --flag="value"');
    expect(result).toBe('Run test --flag="value"');
  });
});

describe('loadAllSkills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temu-test-skills-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no skills directory exists', async () => {
    const skills = await loadAllSkills(tmpDir);
    expect(skills).toEqual([]);
  });

  it('loads skills from project .temu/skills directory', async () => {
    const skillDir = path.join(tmpDir, '.temu', 'skills', 'deploy');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\ndescription: Deploy the app\n---\nDeploy steps here');

    const skills = await loadAllSkills(tmpDir);
    const deploy = skills.find((s) => s.name === 'deploy');
    expect(deploy).toBeDefined();
    expect(deploy!.description).toBe('Deploy the app');
    expect(deploy!.content).toBe('Deploy steps here');
    expect(deploy!.source).toBe('project');
  });

  it('loads top-level .md files as skills', async () => {
    const skillsDir = path.join(tmpDir, '.temu', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'review.md'), '---\ndescription: Review code\n---\nReview steps');

    const skills = await loadAllSkills(tmpDir);
    const review = skills.find((s) => s.name === 'review');
    expect(review).toBeDefined();
    expect(review!.description).toBe('Review code');
  });

  it('handles SKILL.md without frontmatter', async () => {
    const skillDir = path.join(tmpDir, '.temu', 'skills', 'simple');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'Just plain content');

    const skills = await loadAllSkills(tmpDir);
    const simple = skills.find((s) => s.name === 'simple');
    expect(simple).toBeDefined();
    expect(simple!.content).toBe('Just plain content');
    expect(simple!.description).toContain('simple');
  });

  it('handles empty frontmatter description', async () => {
    const skillDir = path.join(tmpDir, '.temu', 'skills', 'empty');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\ntitle: something\n---\nBody here');

    const skills = await loadAllSkills(tmpDir);
    const empty = skills.find((s) => s.name === 'empty');
    expect(empty).toBeDefined();
    // Should use fallback description
    expect(empty!.description).toContain('empty');
  });
});
