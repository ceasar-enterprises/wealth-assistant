import { WealthSdk } from './sdk';
import type { SummariseInput } from './summarise';

/**
 * Generic terminal hook: wire any AI/coding terminal into the SDK so that
 * when a session ends its transcript is auto-summarised and stored.
 *
 * Usage:
 *   const hook = createSessionHook({ source: 'opencode' });
 *   hook.onSessionEnd({
 *     lines: [...], projectId: 'wealth-assistant', startedAt, endedAt,
 *   });
 */

export interface SessionHook {
  /** Summarise + store a finished session; returns the saved record. */
  onSessionEnd(input: SummariseInput): ReturnType<WealthSdk['ingest']>;
  /** Recall a stored summary. */
  recall(id: string): ReturnType<WealthSdk['recall']>;
  /** List stored summaries (optionally per project). */
  list(opts?: { projectId?: string; limit?: number }): ReturnType<WealthSdk['list']>;
  /** Number of stored summaries. */
  count(projectId?: string): number;
  /** Release the underlying store handle. */
  close(): void;
}

export function createSessionHook(opts: { dbFile?: string } = {}): SessionHook {
  const sdk = new WealthSdk(opts.dbFile);

  return {
    onSessionEnd(input) {
      return sdk.ingest(input);
    },
    recall(id) {
      return sdk.recall(id);
    },
    list(listOpts) {
      return sdk.list(listOpts);
    },
    count(projectId) {
      return sdk.count(projectId);
    },
    close() {
      sdk.close();
    },
  };
}