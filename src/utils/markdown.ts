import chalk from 'chalk';

// Lightweight markdown rendering for terminal output
// Handles: headers, bold, italic, code blocks, inline code, lists

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  for (const line of lines) {
    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.trimStart().slice(3).trim();
        result.push(chalk.dim(`─── ${codeLanguage || 'code'} ───`));
        continue;
      } else {
        inCodeBlock = false;
        result.push(chalk.dim('─'.repeat(20)));
        continue;
      }
    }

    if (inCodeBlock) {
      result.push(chalk.cyan(line));
      continue;
    }

    let processed = line;

    // Headers
    if (processed.startsWith('### ')) {
      result.push(chalk.bold.yellow(processed.slice(4)));
      continue;
    }
    if (processed.startsWith('## ')) {
      result.push(chalk.bold.blue(processed.slice(3)));
      continue;
    }
    if (processed.startsWith('# ')) {
      result.push(chalk.bold.green(processed.slice(2)));
      continue;
    }

    // Inline code
    processed = processed.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

    // Bold
    processed = processed.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));

    // Italic
    processed = processed.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));

    // List items
    if (processed.match(/^\s*[-*]\s/)) {
      processed = processed.replace(/^(\s*)([-*])\s/, '$1• ');
    }

    result.push(processed);
  }

  return result.join('\n');
}
