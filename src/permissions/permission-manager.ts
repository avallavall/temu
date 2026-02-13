import type { PermissionChecker, PermissionResult } from '../tools/types.js';
import { logger } from '../utils/logger.js';

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions';

interface PermissionRule {
  type: 'allow' | 'ask' | 'deny';
  tool: string;
  specifier?: string;
}

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'ListDir', 'AskUser']);

export class PermissionManager implements PermissionChecker {
  private rules: PermissionRule[] = [];
  private mode: PermissionMode = 'default';
  private sessionAllowed = new Set<string>();

  constructor(mode?: PermissionMode, allowRules?: string[], denyRules?: string[]) {
    this.mode = mode ?? 'default';
    if (allowRules) {
      for (const rule of allowRules) {
        this.rules.push(this.parseRule('allow', rule));
      }
    }
    if (denyRules) {
      for (const rule of denyRules) {
        this.rules.push(this.parseRule('deny', rule));
      }
    }
  }

  private parseRule(type: 'allow' | 'ask' | 'deny', raw: string): PermissionRule {
    const match = raw.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match) return { type, tool: raw };
    return { type, tool: match[1], specifier: match[2] };
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
    logger.debug(`Permission mode set to: ${mode}`);
  }

  addAllowRule(rule: string): void {
    this.rules.push(this.parseRule('allow', rule));
  }

  addDenyRule(rule: string): void {
    this.rules.push(this.parseRule('deny', rule));
  }

  allowForSession(toolKey: string): void {
    this.sessionAllowed.add(toolKey);
  }

  async check(toolName: string, args?: Record<string, unknown>): Promise<PermissionResult> {
    // bypassPermissions mode: allow everything
    if (this.mode === 'bypassPermissions') {
      return { allowed: true };
    }

    // Check explicit deny rules first
    for (const rule of this.rules) {
      if (rule.type === 'deny' && this.matchesRule(rule, toolName, args)) {
        return { allowed: false, reason: `Denied by rule: ${rule.tool}(${rule.specifier ?? '*'})` };
      }
    }

    // Check explicit allow rules
    for (const rule of this.rules) {
      if (rule.type === 'allow' && this.matchesRule(rule, toolName, args)) {
        return { allowed: true };
      }
    }

    // Check session-level allows
    const toolKey = this.getToolKey(toolName, args);
    if (this.sessionAllowed.has(toolName) || this.sessionAllowed.has(toolKey)) {
      return { allowed: true };
    }

    // Read tools are always allowed
    if (READ_TOOLS.has(toolName)) {
      return { allowed: true };
    }

    // Mode-specific behavior
    switch (this.mode) {
      case 'dontAsk':
        return { allowed: true };

      case 'acceptEdits':
        if (toolName === 'Edit' || toolName === 'MultiEdit' || toolName === 'Write') {
          return { allowed: true };
        }
        if (toolName === 'Bash') {
          return { needsApproval: true, description: this.describeToolCall(toolName, args) };
        }
        return { allowed: true };

      case 'plan':
        if (WRITE_TOOLS.has(toolName)) {
          return { allowed: false, reason: 'Plan mode: write operations are not allowed' };
        }
        return { allowed: true };

      case 'default':
      default:
        if (WRITE_TOOLS.has(toolName)) {
          return { needsApproval: true, description: this.describeToolCall(toolName, args) };
        }
        return { allowed: true };
    }
  }

  private matchesRule(rule: PermissionRule, toolName: string, args?: Record<string, unknown>): boolean {
    if (rule.tool !== toolName) return false;
    if (!rule.specifier) return true;

    // Match specifier against args (e.g., Bash(git *) matches command starting with "git")
    if (toolName === 'Bash' && args?.command) {
      return this.matchWildcard(rule.specifier, args.command as string);
    }
    if ((toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') && args?.file_path) {
      return this.matchWildcard(rule.specifier, args.file_path as string);
    }
    return false;
  }

  private matchWildcard(pattern: string, value: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }

  private getToolKey(toolName: string, args?: Record<string, unknown>): string {
    if (toolName === 'Bash' && args?.command) {
      return `Bash(${(args.command as string).split(' ')[0]})`;
    }
    return toolName;
  }

  private describeToolCall(toolName: string, args?: Record<string, unknown>): string {
    switch (toolName) {
      case 'Bash':
        return `Execute: ${(args?.command as string)?.slice(0, 100) ?? 'unknown command'}`;
      case 'Edit':
      case 'MultiEdit':
        return `Edit file: ${args?.file_path ?? 'unknown'}`;
      case 'Write':
        return `Create file: ${args?.file_path ?? 'unknown'}`;
      default:
        return `${toolName} with args: ${JSON.stringify(args).slice(0, 100)}`;
    }
  }
}
