import chalk from 'chalk';

export function formatDiff(oldText: string, newText: string, filePath: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const lines: string[] = [];

  lines.push(chalk.bold(`--- ${filePath}`));

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  let contextBefore = 0;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      contextBefore++;
      if (contextBefore <= 2) {
        lines.push(chalk.dim(`  ${i + 1} │ ${oldLine ?? ''}`));
      }
      continue;
    }

    contextBefore = 0;
    if (oldLine !== undefined && !newLines.includes(oldLine)) {
      lines.push(chalk.red(`- ${i + 1} │ ${oldLine}`));
    }
    if (newLine !== undefined && !oldLines.includes(newLine)) {
      lines.push(chalk.green(`+ ${i + 1} │ ${newLine}`));
    }
  }

  return lines.join('\n');
}
