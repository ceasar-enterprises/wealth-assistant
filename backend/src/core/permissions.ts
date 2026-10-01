import type { Scope, TrustMember, TrustRole } from './model';

/** Hard boundary: every role's base capabilities within a trust. */
const ROLE_CAPS: Record<TrustRole, ReadonlySet<string>> = {
  principal: new Set([
    'manage_members',
    'manage_settings',
    'approve_money_move',
    'propose_money_move',
    'view_assets',
    'view_reports',
    'view_audit',
    'manage_assets',
    'automation_control',
    'emergency_lock',
    'export',
  ]),
  steward: new Set([
    'propose_money_move',
    'view_assets',
    'view_reports',
    'manage_assets',
    'view_audit',
  ]),
  advisor: new Set(['view_assets', 'view_reports']),
};

/** Base capability granted by a role. */
export function capabilitiesFor(role: TrustRole): ReadonlySet<string> {
  return ROLE_CAPS[role];
}

/** Does a role have a capability at all (regardless of scope)? */
export function hasCapability(role: TrustRole, capability: string): boolean {
  return ROLE_CAPS[role].has(capability);
}

/** Does this member have the capability within the given scope? */
export function canInScope(member: TrustMember, capability: string, scope: Scope): boolean {
  if (!hasCapability(member.role, capability)) return false;
  // Principals operate across the whole trust; others are scope-bound.
  if (member.role === 'principal') return true;
  return member.scopes.includes(scope);
}

/**
 * Grant a member (or escalate) within a trust. Only a principal may grant or
 * revoke. Adding/removing authority is a **high-risk action**  it must be
 * gated like other high-value moves.
 */
export function grantMember(
  actorRole: TrustRole,
  target: TrustMember,
  grantedBy: string,
  nowIso = new Date().toISOString(),
): TrustMember {
  if (actorRole !== 'principal') {
    throw new Error('Only a principal may grant trust membership.');
  }
  return {
    ...target,
    grantedAt: nowIso,
    grantedBy,
  };
}

/** Revocation returns the trusted state the caller should enforce going forward. */
export function revokeMember(
  actorRole: TrustRole,
  member: TrustMember,
): { revoked: boolean; reason?: string } {
  if (actorRole !== 'principal') {
    return { revoked: false, reason: 'Only a principal may revoke trust membership.' };
  }
  if (member.role === 'principal') {
    return { revoked: false, reason: 'The principal cannot revoke themselves.' };
  }
  return { revoked: true };
}

/** Ordinary view-access check used by data accessors. */
export function canViewAnyAssets(member: TrustMember): boolean {
  return (
    member.role === 'principal' ||
    member.scopes.includes('assets') ||
    member.scopes.includes('reports')
  );
}

/** Advisor is strictly read-only  they can never propose moves. */
export function canReadOnly(member: TrustMember): boolean {
  return member.role === 'advisor';
}