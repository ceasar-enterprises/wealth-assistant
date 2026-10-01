#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { parseArgs } from 'util';
import { WealthSdk } from './sdk';
import { Service } from './service';
import { startServer } from './server';
import type { ExportFormat } from './summarise';

const USAGE = `Wealth Command SDK - developer AI-terminal session summariser

Usage:
  wealth-sdk summarize <transcript-file> [--project <id>] [--source <label>] [--dry-run] [--format md|json|text]
  wealth-sdk list [--project <id>] [--limit <n>] [--json]
  wealth-sdk recall <id> [--format md|json|text]
  wealth-sdk history <id> [--json]
  wealth-sdk count [--project <id>]
  wealth-sdk remove <id>
  wealth-sdk export <id> [--format md|json|text] [-o <file>]
  wealth-sdk serve [--port <n>] [--db <file>]
  wealth-sdk status [--db <file>]

Options:
  --db <file>       SQLite database file (default: ./wealth-sdk.sqlite)
  --project <id>    Project/trust scope tag for the session
  --source <label>  Terminal/session source label (default: "cli")
  --format <f>      Output format: md (default), json, text
  --dry-run         Summarize only, do not store
  --limit <n>       Max records to list (default 50)`;

type Format = ExportFormat;

const FORMATS: Format[] = ['md', 'json', 'text'];

interface Parsed {
  command: string;
  args: string[];
  db?: string;
  project?: string;
  source?: string;
  format?: Format;
  dryRun?: boolean;
  limit?: number;
  json?: boolean;
  out?: string;
  port?: number;
}

function parse(argv: string[]): Parsed {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      db: { type: 'string' },
      project: { type: 'string' },
      source: { type: 'string' },
      format: { type: 'string' },
      'dry-run': { type: 'boolean' },
      limit: { type: 'string' },
      json: { type: 'boolean' },
      out: { type: 'string', short: 'o' },
      port: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const fmt = (values.format ?? 'md') as string;
  if (!FORMATS.includes(fmt as Format)) fail(`unknown format: ${fmt}`);

  return {
    command: positionals[0],
    args: positionals.slice(1),
    db: typeof values.db === 'string' ? values.db : undefined,
    project: typeof values.project === 'string' ? values.project : undefined,
    source: typeof values.source === 'string' ? values.source : undefined,
    format: fmt as Format,
    dryRun: values['dry-run'] === true,
    limit: typeof values.limit === 'string' ? parseInt(values.limit, 10) : undefined,
    json: values.json === true,
    out: typeof values.out === 'string' ? values.out : undefined,
    port: typeof values.port === 'string' ? parseInt(values.port, 10) : undefined,
  };
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function readLines(file: string): string[] {
  if (!existsSync(file)) fail(`file not found: ${file}`);
  return readFileSync(file, 'utf8').split(/\r?\n/);
}

function summarizeLine(record: { summary: string; startedAt: string; projectId?: string | null; id: string }): string {
  const when = record.startedAt.slice(0, 19).replace('T', ' ');
  const proj = record.projectId ? ` [${record.projectId}]` : '';
  const sum = record.summary.replace(/\n/g, ' ');
  return `${record.id}  ${when}${proj}  ${sum.length > 70 ? `${sum.slice(0, 67)}...` : sum}`;
}

async function main(argv: string[]) {
  const p = parse(argv);

  // Serve command: long-running daemon with its own service-law lifecycle.
  if (p.command === 'serve') {
    await startServer({ dbFile: p.db, port: p.port ?? 4171 });
    return;
  }

  if (p.command === 'status') {
    const db = p.db;
    const dataDir = db ? db.replace(/[\\/][^\\/]*$/, '') : undefined;
    if (dataDir) {
      const service = new Service({ name: 'wealth-sdk', dataDir });
      service.log('info', 'status requested');
      void service;
    }
    const sdk = new WealthSdk(db);
    console.log(`db: ${db ?? '(default ./wealth-sdk.sqlite)'}`);
    console.log(`sessions: ${sdk.count()}`);
    const projects = [...new Set(sdk.list({ limit: 10000 }).map((r) => r.projectId).filter(Boolean))];
    for (const proj of projects) {
      console.log(`  project ${proj}: ${sdk.count(proj as string)}`);
    }
    sdk.close();
    return;
  }

  const sdk = new WealthSdk(p.db);

  switch (p.command) {
    case 'summarize': {
      if (p.args.length < 1) fail('summarize requires a transcript file path');
      const lines = readLines(p.args[0]);
      const input = {
        lines,
        source: p.source ?? 'cli',
        projectId: p.project,
      };
      const format = p.format ?? 'md';
      if (p.dryRun) {
        const summary = sdk.preview(input);
        console.log(sdk.render({ ...summary, source: summary.source }, format));
      } else {
        const record = sdk.ingest(input);
        const out = sdk.render(record, format);
        if (p.out) {
          writeFileSync(p.out, out);
          console.log(`wrote ${p.out}`);
        } else {
          console.log(out);
        }
      }
      sdk.close();
      break;
    }

    case 'list': {
      const records = sdk.list({ projectId: p.project, limit: p.limit ?? 50 });
      if (p.json) {
        console.log(JSON.stringify(records, null, 2));
      } else {
        for (const r of records) console.log(summarizeLine(r));
        console.log(`(${records.length} record(s))`);
      }
      sdk.close();
      break;
    }

    case 'recall': {
      if (p.args.length < 1) fail('recall requires a session id');
      const rec = sdk.recall(p.args[0]);
      if (!rec) fail(`no session ${p.args[0]}`);
      const out = sdk.render(rec, p.format ?? 'md');
      if (p.out) {
        writeFileSync(p.out, out);
        console.log(`wrote ${p.out}`);
      } else {
        console.log(out);
      }
      sdk.close();
      break;
    }

    case 'history': {
      if (p.args.length < 1) fail('history requires a session id');
      const revs = sdk.history(p.args[0]);
      if (revs.length === 0) fail(`no history for ${p.args[0]}`);
      console.log(JSON.stringify(revs, null, 2));
      sdk.close();
      break;
    }

    case 'count': {
      console.log(sdk.count(p.project).toString());
      sdk.close();
      break;
    }

    case 'remove': {
      if (p.args.length < 1) fail('remove requires a session id');
      console.log(sdk.remove(p.args[0]) ? 'removed' : 'not found');
      sdk.close();
      break;
    }

    case 'export': {
      if (p.args.length < 1) fail('export requires a session id');
      const rec = sdk.recall(p.args[0]);
      if (!rec) fail(`no session ${p.args[0]}`);
      const out = sdk.render(rec, p.format ?? 'md');
      if (p.out) {
        writeFileSync(p.out, out);
        console.log(`wrote ${p.out}`);
      } else {
        console.log(out);
      }
      sdk.close();
      break;
    }

    default:
      fail(`unknown command: ${p.command}`);
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`error: ${String(err)}`);
  process.exit(1);
});