import type { MoneyMove, TrustRole } from './model';

/**
 * Money-move state machine. The stewardship principle: automation and stewards
 * propose; the Principal disposes. High-risk moves require escalation (e.g. a
 * second factor / co-approval) and can never auto-execute.
 */

export interface MoneyMoveEvents {
  proposedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  at?: string;
}

export type MoveResult =
  | { ok: true; move: MoneyMove; event: 'proposed' | 'approved' | 'executed' | 'rejected' | 'cancelled' }
  | { ok: false; reason: string };

function iso(at = new Date().toISOString()) {
  return at;
}

/** Create a proposed move (steward or principal). Starts as pending. */
export function proposeMove(
  current: Pick<MoneyMove, 'description' | 'direction' | 'amount' | 'currency' | 'payee' | 'rail'>,
  proposedBy: string,
  highRisk = false,
): MoveResult {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const move: MoneyMove = {
    id,
    trustId: '',
    state: 'pending',
    description: current.description,
    direction: current.direction,
    amount: current.amount,
    currency: current.currency,
    payee: current.payee,
    rail: current.rail,
    highRisk,
    proposedBy,
    proposedAt: iso(),
  };
  return { ok: true, move, event: 'proposed' };
}

/**
 * Approve a pending move. `actorRole` must be principal. High-risk moves must
 * pass `escalationConfirmed` (e.g. MFA / co-approval) before approval.
 */
export function approveMove(
  move: MoneyMove,
  actorRole: TrustRole,
  events: MoneyMoveEvents,
  escalationConfirmed = false,
): MoveResult {
  if (move.state !== 'pending') {
    return { ok: false, reason: `Cannot approve a move in state '${move.state}'.` };
  }
  if (actorRole !== 'principal') {
    return { ok: false, reason: 'Only the principal may approve a money move.' };
  }
  if (move.highRisk && !escalationConfirmed) {
    return {
      ok: false,
      reason: 'High-risk move requires escalation confirmation (second factor / co-approval).',
    };
  }
  return {
    ok: true,
    event: 'approved',
    move: {
      ...move,
      state: 'approved',
      approvedBy: events.approvedBy,
      approvedAt: iso(events.at),
    },
  };
}

/** Reject a pending move (principal only). */
export function rejectMove(
  move: MoneyMove,
  actorRole: TrustRole,
  rejectedBy: string,
): MoveResult {
  if (move.state !== 'pending') {
    return { ok: false, reason: `Cannot reject a move in state '${move.state}'.` };
  }
  if (actorRole !== 'principal') {
    return { ok: false, reason: 'Only the principal may reject a money move.' };
  }
  return {
    ok: true,
    event: 'rejected',
    move: { ...move, state: 'rejected', rejectedBy, rejectedAt: iso() },
  };
}

/** Execute an approved move. Requires the move to be approved (+ approval recorded). */
export function executeMove(
  move: MoneyMove,
  actorRole: TrustRole,
  executedBy: string,
): MoveResult {
  if (move.state !== 'approved') {
    return { ok: false, reason: `Cannot execute a move in state '${move.state}'.` };
  }
  if (actorRole !== 'principal' && actorRole !== 'steward') {
    return { ok: false, reason: 'Only principal or steward may execute an approved move.' };
  }
  if (!move.approvedBy) {
    return { ok: false, reason: 'Move was approved but missing approver record.' };
  }
  return {
    ok: true,
    event: 'executed',
    move: { ...move, state: 'executed', executedBy, executedAt: iso() },
  };
}

export function cancelMove(move: MoneyMove, by: string): MoveResult {
  if (move.state === 'executed' || move.state === 'rejected') {
    return { ok: false, reason: `Cannot cancel a move in state '${move.state}'.` };
  }
  return {
    ok: true,
    event: 'cancelled',
    move: { ...move, state: 'cancelled', cancelledBy: by, cancelledAt: iso() },
  };
}

/** Rule of thumb flag for high-risk: large value or outgoing to a new payee. */
export function isHighRisk(amount: number, thresholdUsd: number, direction: 'in' | 'out'): boolean {
  return direction === 'out' && amount >= thresholdUsd;
}