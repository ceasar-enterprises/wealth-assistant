import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { WealthSdk } from './sdk';
import { Service } from './service';
import type { ExportFormat } from './summarise';

/**
 * Local REST API for the Wealth SDK — lets external developers / AI
 * terminals talk to the summariser over HTTP. Service-law compliant:
 * single instance (pid lock), status.json, service.log, minimal traffic.
 *
 * Endpoints:
 *   GET  /health                -> { ok, sessions }
 *   POST /summarise             -> summarize a transcript (dry run, no store)
 *   POST /sessions              -> summarize + store
 *   GET  /sessions              -> list (query: ?project=, ?limit=)
 *   GET  /sessions/:id          -> recall (Accept: application/json | text/markdown)
 *   GET  /sessions/:id/history  -> revision history
 *   GET  /sessions/:id/export?format=md|json|text -> file download
 *   DELETE /sessions/:id        -> remove
 *   GET  /count                 -> session count
 */

export interface ServerOptions {
  dbFile?: string;
  port?: number;
  host?: string;
}

export interface StartedServer {
  server: Server;
  port: number;
  close: () => void;
}

export function startServer(opts: ServerOptions = {}): Promise<StartedServer> {
  const port = opts.port ?? parseInt(process.env.WEALTH_SDK_PORT || '4171', 10);
  const host = opts.host ?? '127.0.0.1';

  const dataDir = opts.dbFile ? opts.dbFile.replace(/[\\/][^\\/]*$/, '') : undefined;
  const service = new Service({ name: 'wealth-sdk', dataDir });
  const sdk = new WealthSdk(opts.dbFile);

  if (!service.acquireLock()) {
    service.log('warn', `Another wealth-sdk server holds the lock; not binding on :${port}.`);
    return Promise.reject(new Error(`wealth-sdk server already running (lock held). Use existing instance.`));
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handle(req, res, sdk).catch((err) => {
        service.log('error', `Handler error: ${String(err)}`);
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      service.log('error', `Server error: ${err.message}`);
      service.releaseLock();
      sdk.close();
      reject(err);
    });

    server.listen(port, host, () => {
      service.log('info', `wealth-sdk API listening on http://${host}:${port}`);
      service.writeStatus({ port, host, db: opts.dbFile ?? '(default)', running: true });
      resolve({
        server,
        port,
        close: () => {
          service.log('info', 'Shutting down.');
          service.writeStatus({ port, host, running: false });
          server.close();
          service.releaseLock();
          sdk.close();
        },
      });
    });
  });
}

/* ------------------------------------------------------------------ */

function sendJson(res: ServerResponse, code: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error(`invalid JSON body: ${String(err)}`));
      }
    });
    req.on('error', reject);
  });
}

async function handle(req: IncomingMessage, res: ServerResponse, sdk: WealthSdk) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ['sessions', id, 'history']
  const method = (req.method ?? 'GET').toUpperCase();

  // Health
  if (parts[0] === 'health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, sessions: sdk.count() });
  }

  // /summarise (dry run)
  if (parts[0] === 'summarise' && method === 'POST') {
    const body = await readBody(req);
    const lines = Array.isArray(body.lines) ? body.lines.map(String) : [];
    const summary = sdk.preview({
      lines,
      source: String(body.source ?? 'api'),
      projectId: body.projectId ? String(body.projectId) : undefined,
      startedAt: body.startedAt ? String(body.startedAt) : undefined,
      endedAt: body.endedAt ? String(body.endedAt) : undefined,
    });
    return sendJson(res, 200, { ok: true, result: summary });
  }

  // POST /sessions -> summarize + store
  if (parts[0] === 'sessions' && parts.length === 1 && method === 'POST') {
    const body = await readBody(req);
    if (!Array.isArray(body.lines)) return sendJson(res, 400, { ok: false, error: 'body.lines (array) required' });
    const record = sdk.ingest({
      id: body.id ? String(body.id) : undefined,
      lines: body.lines.map(String),
      source: String(body.source ?? 'api'),
      projectId: body.projectId ? String(body.projectId) : undefined,
      startedAt: body.startedAt ? String(body.startedAt) : undefined,
      endedAt: body.endedAt ? String(body.endedAt) : undefined,
    });
    return sendJson(res, 201, { ok: true, record });
  }

  // GET /sessions?project=&limit=
  if (parts[0] === 'sessions' && parts.length === 1 && method === 'GET') {
    const projectId = url.searchParams.get('project') ?? undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const records = sdk.list({ projectId, limit });
    return sendJson(res, 200, { ok: true, records, count: records.length });
  }

  // GET /count
  if (parts[0] === 'count' && method === 'GET') {
    return sendJson(res, 200, { ok: true, count: sdk.count(url.searchParams.get('project') ?? undefined) });
  }

  // /sessions/:id/history
  if (parts[0] === 'sessions' && parts.length === 3 && parts[2] === 'history' && method === 'GET') {
    const revs = sdk.history(parts[1]);
    if (revs.length === 0) return sendJson(res, 404, { ok: false, error: `no session ${parts[1]}` });
    return sendJson(res, 200, { ok: true, revisions: revs });
  }

  // /sessions/:id/export
  if (parts[0] === 'sessions' && parts.length === 3 && parts[2] === 'export' && method === 'GET') {
    const rec = sdk.recall(parts[1]);
    if (!rec) return sendJson(res, 404, { ok: false, error: `no session ${parts[1]}` });
    const format = (url.searchParams.get('format') ?? 'md') as ExportFormat;
    const text = sdk.render(rec, format);
    const ctype = format === 'json' ? 'application/json' : format === 'text' ? 'text/plain' : 'text/markdown';
    res.writeHead(200, { 'content-type': ctype, 'content-disposition': `attachment; filename="${rec.id}.${format}"` });
    return res.end(text);
  }

  // /sessions/:id
  if (parts[0] === 'sessions' && parts.length === 2) {
    if (method === 'GET') {
      const rec = sdk.recall(parts[1]);
      if (!rec) return sendJson(res, 404, { ok: false, error: `no session ${parts[1]}` });
      return sendJson(res, 200, { ok: true, record: rec });
    }
    if (method === 'DELETE') {
      const ok = sdk.remove(parts[1]);
      return sendJson(res, ok ? 200 : 404, { ok, removed: ok });
    }
  }

  return sendJson(res, 404, { ok: false, error: `not found: ${method} ${url.pathname}` });
}