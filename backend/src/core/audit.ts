import { randomUUID } from 'crypto';
import type { AuditEntry, TrustRole } from './model';

/**
 * Audit log  append-only by convention. Every material action (grant/revoke,
 * approve/reject/execute, export, kill-switch) is recorded. Audits are never
 * updated or deleted in normal operation.
 */
export function auditEntry(input: {
  trustId: string;
  actorUid: string;
  actorRole?: TrustRole;
  action: string;
  detail?: Record<string, unknown>;
}): AuditEntry {
  return {
    id: randomUUID(),
    trustId: input.trustId,
    at: new Date().toISOString(),
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: input.action,
    detail: input.detail ?? {},
  };
}

/** Human-readable line for the audit report. */
export function auditToLine(entry: AuditEntry): string {
  const who = entry.actorRole ? `${entry.actorRole}:${entry.actorUid}` : entry.actorUid;
  const detail = Object.keys(entry.detail).length
    ? ` ${JSON.stringify(entry.detail)}`
    : '';
  return `[${entry.at}] ${entry.action} by ${who}${detail}`;
}

export const AUDIT_ACTIONS = {
  MEMBER_GRANTED: 'member.granted',
  MEMBER_REVOKED: 'member.revoked',
  MONEY_MOVE_PROPOSED: 'money_move.proposed',
  MONEY_MOVE_APPROVED: 'money_move.approved',
  MONEY_MOVE_REJECTED: 'money_move.rejected',
  MONEY_MOVE_EXECUTED: 'money_move.executed',
  EXPORT_REQUESTED: 'export.requested',
  AUTOMATION_PAUSED: 'automation.paused',
  AUTOMATION_RESUMED: 'automation.resumed',
  EMERGENCY_LOCK: 'security.emergency_lock',
} as const;