/**
 * Wealth Command SDK — developer AI-terminal session summariser.
 *
 * Public surface:
 *  - WealthSdk          high-level facade (summarise/ingest/recall/render)
 *  - SessionStore       raw SQLite store
 *  - summarise, render  deterministic summariser + markdown/json/text output
 *  - createSessionHook  terminal hook factory
 *  - startServer        local REST API
 */

export { WealthSdk } from './sdk';
export { SessionStore, DEFAULT_DB } from './store';
export type { SessionSaveInput, SessionRecord } from './store';
export { summarise, render, toMarkdown, toJson, toText } from './summarise';
export type { ExportFormat, SummariseInput } from './summarise';
export { createSessionHook } from './hook';
export type { SessionHook } from './hook';
export { startServer } from './server';
export { Service } from './service';

export type { SessionSummary } from 'wealth-assistant-backend';