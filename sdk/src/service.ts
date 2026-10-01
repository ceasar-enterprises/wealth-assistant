import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { isAbsolute, join } from 'path';

/**
 * Service-law helpers (single instance, status snapshot, log, pid lock)
 * shared by the CLI, REST server, and hooks. Each command/daemon gets its
 * own lock name so they don't collide with each other (nor with the widget
 * bridge on port 4170).
 */

export interface ServiceOptions {
  name: string;
  dataDir?: string;
}

export class Service {
  readonly name: string;
  readonly dir: string;
  readonly statusFile: string;
  readonly logFile: string;
  readonly lockFile: string;
  private acquired = false;

  constructor(opts: ServiceOptions) {
    this.name = opts.name;
    this.dir = opts.dataDir ?? join(process.cwd(), 'data');
    this.statusFile = join(this.dir, `${this.name}-status.json`);
    this.logFile = join(this.dir, `${this.name}.log`);
    this.lockFile = join(this.dir, `${this.name}.pid`);
    mkdirSync(this.dir, { recursive: true });
  }

  log(level: 'info' | 'warn' | 'error', msg: string) {
    try {
      appendFileSync(this.logFile, `[${new Date().toISOString()}] ${level}: ${msg}\n`);
    } catch {
      /* best-effort */
    }
  }

  writeStatus(snapshot: Record<string, unknown> = {}) {
    const payload = { service: this.name, pid: process.pid, at: new Date().toISOString(), ...snapshot };
    const tmp = this.statusFile + '.tmp';
    try {
      writeFileSync(tmp, JSON.stringify(payload, null, 2));
      renameSync(tmp, this.statusFile);
    } catch {
      /* best-effort */
    }
  }

  /**
   * Attempt to acquire the single-instance lock. Returns false if another
   * process holds it (liveness-checked: stale pid files are reclaimed).
   */
  acquireLock(): boolean {
    const pid = process.pid;
    if (existsSync(this.lockFile)) {
      const existing = this.readPid();
      if (existing && this.alive(existing)) {
        this.log('warn', `Another ${this.name} instance is running (pid ${existing}). Refusing duplicate.`);
        return false;
      }
      // Stale lock from a dead process — reclaim.
      this.log('warn', `Stale lock (pid ${existing ?? '?'}) — reclaiming.`);
    }
    try {
      writeFileSync(this.lockFile, String(pid));
      this.log('info', `Lock acquired (pid ${pid}).`);
    } catch (err) {
      this.log('error', `Could not write lock ${String(err)}`);
      return false;
    }
    this.acquired = true;
    return true;
  }

  releaseLock() {
    try {
      if (this.acquired || this.readPid() === process.pid) {
        unlinkSync(this.lockFile);
        this.acquired = false;
      }
    } catch {
      /* best-effort */
    }
  }

  private readPid(): number | null {
    try {
      const v = parseInt(readFileSync(this.lockFile, 'utf8').trim(), 10);
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  private alive(pid: number): boolean {
    if (process.platform === 'win32') {
      // Windows has no kill(0); use tasklist filtered by pid. Runs only at
      // acquire time (startup), so it is cheap enough.
      try {
        const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' });
        return out.includes(String(pid));
      } catch {
        return false;
      }
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

export function resolveDbPath(dataDir: string, fileName: string): string {
  return isAbsolute(fileName) ? fileName : join(dataDir, fileName);
}

export { existsSync, mkdirSync };