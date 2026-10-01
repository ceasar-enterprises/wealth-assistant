/**
 * Core domain model for Wealth Command  asset stewardship.
 *
 * The key structural shift vs the absorbed FinApp: data is owned by a **trust**
 * (the Principal's estate / holding), not by a raw Firebase uid. Principals own,
 * Stewards operate under scoped authority, Advisors read within a granted scope.
 */

/** Roles within a trust. Principal = owner. Steward = operator. Advisor = read-only. */
export type TrustRole = 'principal' | 'steward' | 'advisor';

/** Kind of trust. A holding company / family office / individual estate. */
export type TrustKind = 'individual' | 'family_office' | 'holding_company';

/** A trust  the ownership container for assets + people + automation. */
export interface Trust {
  id: string;
  kind: TrustKind;
  name: string;
  /** Principal who created/owns the trust. */
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  /** Base currency for net-worth reporting, e.g. 'USD', 'EUR', 'UGX'. */
  baseCurrency: string;
  /** Kill switch  pauses all automation when true. */
  automationPaused: boolean;
}

/** Membership + role of a user within a trust. */
export interface TrustMember {
  trustId: string;
  uid: string;
  role: TrustRole;
  /** Scope groups the member may operate within (asset category / entity). */
  scopes: string[];
  grantedAt: string;
  grantedBy: string;
}

/** Asset classes the stewardship model covers. */
export type AssetClass =
  | 'bank'
  | 'crypto'
  | 'property'
  | 'vehicle'
  | 'business'
  | 'cash'
  | 'liability'
  | 'other';

/** An asset under stewardship. */
export interface Asset {
  id: string;
  trustId: string;
  class: AssetClass;
  name: string;
  /** Numeric value in `currency`. */
  value: number;
  currency: string;
  /** Source of the value: 'manual' | 'plaid' | 'exchange' | 'estimate'. */
  valueSource: 'manual' | 'plaid' | 'exchange' | 'estimate';
  /** Liquidity class for portfolio analysis. */
  liquidity: 'liquid' | 'illiquid' | 'semi_liquid';
  custodian?: string;
  /** Plaid account id if this asset is a connected bank account. */
  plaidAccountId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** State of a money move (proposed payment/transfer). Never auto-executes high-value. */
export type MoneyMoveState =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'cancelled';

/** A proposed movement of money  the "automation proposes, Principal approves" core. */
export interface MoneyMove {
  id: string;
  trustId: string;
  /** What the move does. */
  description: string;
  /** Direction: money out (pay) or in (collect). */
  direction: 'out' | 'in';
  amount: number;
  currency: string;
  /** Optional payment rail / destination. */
  payee?: string;
  rail?: string;
  state: MoneyMoveState;
  proposedBy: string;
  proposedAt: string;
  /** High-risk moves require escalation (co-approval / second factor). */
  highRisk: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedBy?: string;
  executedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

/** One entry in the immutable audit log. */
export interface AuditEntry {
  id: string;
  trustId: string;
  at: string;
  actorUid: string;
  actorRole?: TrustRole;
  action: string;
  detail: Record<string, unknown>;
}

/** A summarized AI/coding session (developer hook). */
export interface SessionSummary {
  id: string;
  /** Optional trust/project scope it belongs to. */
  projectId?: string;
  startedAt: string;
  endedAt: string;
  /** What was accomplished. */
  summary: string;
  /** Decisions made. */
  decisions: string[];
  /** Open threads / questions left. */
  openThreads: string[];
  /** Suggested next steps. */
  nextSteps: string[];
  /** Raw session reference (tool, session id). */
  source: string;
}

/** Scope labels available for members. */
export const SCOPE_LABELS = {
  assets: 'assets',
  people: 'people',
  money: 'money',
  reports: 'reports',
} as const;

export type Scope = (typeof SCOPE_LABELS)[keyof typeof SCOPE_LABELS];