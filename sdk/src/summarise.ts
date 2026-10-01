import { buildSessionSummary } from 'wealth-assistant-backend';
import type { SessionSummary } from 'wealth-assistant-backend';

/**
 * Summarise a raw session transcript into a structured summary, then render
 * it as markdown, JSON, or plain text. This wraps the backend engine's
 * buildSessionSummary so the SDK stays a thin, dependency-free surface.
 */

export interface SummariseInput {
  lines: string[];
  source: string;
  projectId?: string;
  startedAt?: string;
  endedAt?: string;
}

export function summarise(input: SummariseInput): SessionSummary {
  return buildSessionSummary(input);
}

/** Bullet list of strings, "none" when empty (ASCII-safe title casing). */
function bullets(items: string[]): string {
  if (!items || items.length === 0) return '- none';
  return items.map((i) => `- ${i}`).join('\n');
}

export function toMarkdown(summary: SessionSummary): string {
  const head: string[] = [
    `# Session summary${summary.projectId ? ` - ${summary.projectId}` : ''}`,
    ``,
    `> source: ${summary.source}`,
    `> ${summary.startedAt} -> ${summary.endedAt}`,
    ``,
    `## What was done`,
    summary.summary,
    ``,
    `## Decisions`,
    bullets(summary.decisions),
    ``,
    `## Open threads`,
    bullets(summary.openThreads),
    ``,
    `## Next steps`,
    bullets(summary.nextSteps),
  ];
  return head.join('\n');
}

export function toJson(summary: SessionSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function toText(summary: SessionSummary): string {
  const head: string[] = [
    `Session: ${summary.id}`,
    `Project: ${summary.projectId ?? '(none)'}`,
    `Source: ${summary.source}`,
    `Range: ${summary.startedAt} -> ${summary.endedAt}`,
    ``,
    `What was done:`,
    summary.summary,
    ``,
    `Decisions:`,
    ...summary.decisions.map((d) => `  - ${d}`),
    ``,
    `Open threads:`,
    ...(summary.openThreads.length ? summary.openThreads.map((t) => `  - ${t}`) : ['  - none']),
    ``,
    `Next steps:`,
    ...(summary.nextSteps.length ? summary.nextSteps.map((s) => `  - ${s}`) : ['  - none']),
  ];
  return head.join('\n');
}

export type ExportFormat = 'md' | 'json' | 'text';

export function render(summary: SessionSummary, format: ExportFormat): string {
  switch (format) {
    case 'md':
      return toMarkdown(summary);
    case 'json':
      return toJson(summary);
    case 'text':
      return toText(summary);
    default:
      throw new Error(`Unknown format: ${String(format)}`);
  }
}