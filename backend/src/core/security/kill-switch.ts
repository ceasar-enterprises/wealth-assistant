import { auditEntry, AUDIT_ACTIONS } from '../audit';
import { ChainedAuditEntry, appendToAuditChain } from './audit-chain';

/**
 * Kill switch + emergency lock/wipe.
 *
 * Mirrors the money-agent's kill-switch principle for the stewardship product:
 *  - paused: automation (proposals/executions by stewards) is blocked.
 *  - emergencyLock: everything except emergency unlock is blocked + signalled.
 *  - wipeRequested: the client wipes local plaintext on next unlock (soft wipe).
 * Every transition is audit-logged on the hash-chained audit log.
 */

export type KillState = 'live' | 'paused' | 'locked';
export type WipeState = 'none' | 'armed';

export interface KillSwitchState {
  state: KillState;
  wipe: WipeState;
  pausedBy?: string;
  pausedAt?: string;
  reason?: string;
}

export const RULE_LIVE: KillSwitchState = { state: 'live', wipe: 'none' };

/** Should an action be blocked right now? Returns { blocked, reason }. */
export function gateAction(
  current: KillSwitchState,
  action: string,
  opts: { emergencySafe?: boolean } = {},
): { blocked: boolean; reason?: string } {
  if (current.state === 'locked') {
    if (opts.emergencySafe) return { blocked: false };
    return { blocked: true, reason: 'Emergency lock is active. Only emergency-safe actions allowed.' };
  }
  if (current.state === 'paused') {
    if (opts.emergencySafe) return { blocked: false };
    return { blocked: true, reason: `Automation paused: '${action}' is blocked.` };
  }
  return { blocked: false };
}

export function pauseAutomation(
  current: KillSwitchState,
  by: string,
  reason: string,
  audit?: ChainedAuditEntry[],
): { state: KillSwitchState; audit?: ChainedAuditEntry } {
  const next: KillSwitchState = {
    ...current,
    state: 'paused',
    pausedBy: by,
    pausedAt: new Date().toISOString(),
    reason,
  };
  const entry = auditEntry({ trustId: 'system', actorUid: by, action: AUDIT_ACTIONS.AUTOMATION_PAUSED, detail: { reason } });
  return { state: next, audit: audit ? appendToAuditChain(audit, entry) : undefined };
}

export function resumeAutomation(
  current: KillSwitchState,
  by: string,
  audit?: ChainedAuditEntry[],
): { state: KillSwitchState; audit?: ChainedAuditEntry } {
  const next: KillSwitchState = { ...current, state: 'live', pausedBy: undefined, pausedAt: undefined, reason: undefined };
  const entry = auditEntry({ trustId: 'system', actorUid: by, action: AUDIT_ACTIONS.AUTOMATION_RESUMED });
  return { state: next, audit: audit ? appendToAuditChain(audit, entry) : undefined };
}

export function emergencyLock(
  current: KillSwitchState,
  by: string,
  audit?: ChainedAuditEntry[],
): { state: KillSwitchState; audit?: ChainedAuditEntry } {
  const next: KillSwitchState = { ...current, state: 'locked' };
  const entry = auditEntry({ trustId: 'system', actorUid: by, action: AUDIT_ACTIONS.EMERGENCY_LOCK });
  return { state: next, audit: audit ? appendToAuditChain(audit, entry) : undefined };
}

export function armWipe(
  current: KillSwitchState,
  by: string,
  audit?: ChainedAuditEntry[],
): { state: KillSwitchState; audit?: ChainedAuditEntry } {
  const next: KillSwitchState = { ...current, wipe: 'armed' };
  const entry = auditEntry({
    trustId: 'system',
    actorUid: by,
    action: 'security.wipe_armed',
    detail: { wipe: 'armed' },
  });
  return { state: next, audit: audit ? appendToAuditChain(audit, entry) : undefined };
}

/** Emergency-safe unlock: restores live but keeps wipe armed if set. */
export function emergencyUnlock(
  current: KillSwitchState,
  by: string,
  audit?: ChainedAuditEntry[],
): { state: KillSwitchState; audit?: ChainedAuditEntry } {
  const next: KillSwitchState = { ...current, state: 'live' };
  const entry = auditEntry({ trustId: 'system', actorUid: by, action: 'security.emergency_unlock' });
  return { state: next, audit: audit ? appendToAuditChain(audit, entry) : undefined };
}