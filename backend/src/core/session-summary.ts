import { randomUUID } from 'crypto';
import type { SessionSummary } from './model';

/**
 * Developer AI-terminal hook: turn a raw session transcript into a structured
 * summary  what was done, decisions, open threads, next steps. This is the
 * productized version of our tab-sync/session-memory system.
 */
export function buildSessionSummary(input: {
  lines: string[];
  source: string;
  projectId?: string;
  startedAt?: string;
  endedAt?: string;
}): SessionSummary {
  const lines = input.lines.map((l) => l.trim()).filter(Boolean);

  const summary = summarizeLines(lines);
  const decisions = pickByPrefixes(lines, ['decision', 'decided', 'agreed', 'chose', 'locked']);
  const openThreads = pickByPrefixes(lines, ['open', 'todo', 'next step', 'follow-up', 'blocked', 'pending', 'question']);
  const nextSteps = pickByPrefixes(lines, ['next', 'then', 'after', 'move', 'build', 'start']);

  return {
    id: randomUUID(),
    projectId: input.projectId,
    startedAt: input.startedAt ?? new Date().toISOString(),
    endedAt: input.endedAt ?? new Date().toISOString(),
    summary,
    decisions,
    openThreads,
    nextSteps,
    source: input.source,
  };
}

function summarizeLines(lines: string[]): string {
  if (lines.length === 0) return 'Empty session.';
  // Very simple heuristic: first ~3 substantive lines. Real implementation
  // would use an LLM summary; this is deterministic and testable.
  const head = lines.slice(0, 3).join('. ');
  return head.length > 280 ? `${head.slice(0, 277)}...` : head;
}

function pickByPrefixes(lines: string[], prefixes: string[]): string[] {
  const hits: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (prefixes.some((p) => lower.startsWith(p))) hits.push(line);
  }
  return hits.slice(0, 20);
}