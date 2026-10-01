import { randomUUID } from 'crypto';
import { SessionStore, SessionSaveInput } from './store';
import { summarise, render, ExportFormat, SummariseInput } from './summarise';
import type { SessionSummary } from 'wealth-assistant-backend';

/**
 * Wealth SDK facade: the developer-facing entry point. Combines the
 * summariser engine with the local SQLite store and rendering helpers.
 *
 * Typical flow for a terminal hook:
 *   const sdk = new WealthSdk();
 *   const record = sdk.ingest({ lines, source, projectId });
 *   console.log(sdk.render(record, 'md'));
 */

export class WealthSdk {
  private store: SessionStore;

  constructor(dbFile?: string) {
    this.store = new SessionStore(dbFile);
  }

  /**
   * Summarise a raw transcript and persist it. Returns the saved record
   * (id auto-generated unless input.id is provided).
   */
  ingest(input: SummariseInput & { id?: string }): SessionSaveInput {
    const summary = summarise(input);
    return this.store.upsert({
      id: input.id ?? summary.id,
      projectId: input.projectId ?? null,
      source: summary.source,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      summary: summary.summary,
      decisions: summary.decisions,
      openThreads: summary.openThreads,
      nextSteps: summary.nextSteps,
    });
  }

  /** Summarise but do not persist (dry run). */
  preview(input: SummariseInput): SessionSummary {
    return summarise(input);
  }

  recall(id: string) {
    return this.store.get(id);
  }

  list(opts?: { projectId?: string; limit?: number }) {
    return this.store.list(opts);
  }

  history(id: string) {
    return this.store.history(id);
  }

  count(projectId?: string): number {
    return this.store.count(projectId);
  }

  remove(id: string): boolean {
    return this.store.delete(id);
  }

  render(record: SessionSaveInput, format: ExportFormat = 'md'): string {
    return render(recordToSummary(record), format);
  }

  close() {
    this.store.close();
  }
}

function recordToSummary(rec: SessionSaveInput): SessionSummary {
  return {
    id: rec.id,
    projectId: rec.projectId ?? undefined,
    startedAt: rec.startedAt,
    endedAt: rec.endedAt,
    summary: rec.summary,
    decisions: rec.decisions,
    openThreads: rec.openThreads,
    nextSteps: rec.nextSteps,
    source: rec.source,
  };
}

export { randomUUID };
export { SessionStore };
// Re-export types
export type { SessionSaveInput, SessionRecord } from './store';
export type { ExportFormat, SummariseInput } from './summarise';