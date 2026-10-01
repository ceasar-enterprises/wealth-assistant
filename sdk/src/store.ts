import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';

/**
 * Local SQLite store for session summaries. Zero native dependencies
 * (built-in node:sqlite). Append-only ledger of every saved snapshot so
 * nothing is lost even if a session is re-summarised.
 */

export const DEFAULT_DB = join(process.cwd(), 'wealth-sdk.sqlite');

export interface SessionSaveInput {
  id: string;
  projectId?: string | null;
  source: string;
  startedAt: string;
  endedAt: string;
  summary: string;
  decisions: string[];
  openThreads: string[];
  nextSteps: string[];
}

export interface SessionRecord extends SessionSaveInput {
  rev: number;
  savedAt: string;
}

interface SessionRow {
  id: string;
  project_id: string | null;
  source: string;
  started_at: string;
  ended_at: string;
  summary: string;
  decisions: string;
  open_threads: string;
  next_steps: string;
  rev: number;
  saved_at: string;
}

export class SessionStore {
  private db: DatabaseSync;
  readonly file: string;

  constructor(file: string = DEFAULT_DB) {
    this.file = file;
    const folder = isAbsolute(file) ? dirname(file) : dirname(join(process.cwd(), file));
    mkdirSync(folder, { recursive: true });
    this.db = new DatabaseSync(file);
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        decisions TEXT NOT NULL,
        open_threads TEXT NOT NULL,
        next_steps TEXT NOT NULL,
        rev INTEGER NOT NULL DEFAULT 1,
        saved_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        rev INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source);
      CREATE INDEX IF NOT EXISTS idx_sessions_saved ON sessions(saved_at);
    `);
  }

  /** Insert or update a session summary; bumps rev, appends to ledger. */
  upsert(input: SessionSaveInput): SessionRecord {
    const now = new Date().toISOString();
    const existing = this.get(input.id);
    const rev = existing ? existing.rev + 1 : 1;
    const rec: SessionRecord = { ...input, rev, savedAt: now };

    this.db
      .prepare(
        `INSERT INTO sessions (id, project_id, source, started_at, ended_at, summary, decisions, open_threads, next_steps, rev, saved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           source = excluded.source,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           summary = excluded.summary,
           decisions = excluded.decisions,
           open_threads = excluded.open_threads,
           next_steps = excluded.next_steps,
           rev = excluded.rev,
           saved_at = excluded.saved_at`,
      )
      .run(
        input.id,
        input.projectId ?? null,
        input.source,
        input.startedAt,
        input.endedAt,
        input.summary,
        JSON.stringify(input.decisions),
        JSON.stringify(input.openThreads),
        JSON.stringify(input.nextSteps),
        rev,
        now,
      );

    this.db
      .prepare(`INSERT INTO ledger (session_id, rev, saved_at, payload) VALUES (?, ?, ?, ?)`)
      .run(input.id, rev, now, JSON.stringify(rec));

    return rec;
  }

  get(id: string): SessionRecord | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  list(opts: { projectId?: string; limit?: number } = {}): SessionRecord[] {
    const { projectId, limit = 50 } = opts;
    if (projectId) {
      const rows = this.db
        .prepare(`SELECT * FROM sessions WHERE project_id = ? ORDER BY saved_at DESC LIMIT ?`)
        .all(projectId, limit) as unknown as SessionRow[];
      return rows.map((r) => this.rowToRecord(r));
    }
    const rows = this.db
      .prepare(`SELECT * FROM sessions ORDER BY saved_at DESC LIMIT ?`)
      .all(limit) as unknown as SessionRow[];
    return rows.map((r) => this.rowToRecord(r));
  }

  count(projectId?: string): number {
    const row = projectId
      ? (this.db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE project_id = ?`).get(projectId) as { c: number })
      : (this.db.prepare(`SELECT COUNT(*) AS c FROM sessions`).get() as { c: number });
    return row.c;
  }

  /** Full revision history for a session id (append-only). */
  history(id: string): SessionRecord[] {
    const rows = this.db
      .prepare(`SELECT payload FROM ledger WHERE session_id = ? ORDER BY rev ASC`)
      .all(id) as unknown as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as SessionRecord);
  }

  delete(id: string): boolean {
    const existed = this.get(id) !== null;
    this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return existed;
  }

  close() {
    this.db.close();
  }

  private rowToRecord(row: SessionRow): SessionRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      source: row.source,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      summary: row.summary,
      decisions: JSON.parse(row.decisions),
      openThreads: JSON.parse(row.open_threads),
      nextSteps: JSON.parse(row.next_steps),
      rev: row.rev,
      savedAt: row.saved_at,
    };
  }
}