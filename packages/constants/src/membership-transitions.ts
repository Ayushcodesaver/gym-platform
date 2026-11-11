/**
 * Membership state machine (PRD §19, master prompt §18).
 * Invalid transitions are rejected server-side; the frontend mirrors this map
 * for UI affordances only — the backend is authoritative.
 */

/** Mirrors MEMBERSHIP_STATUSES (kept local to avoid a constants→types cycle). */
export type MembershipStatus = "pending" | "active" | "frozen" | "expired" | "cancelled";

export const MEMBERSHIP_TRANSITIONS: Record<MembershipStatus, MembershipStatus[]> = {
  pending: ["active", "cancelled"],
  active: ["frozen", "cancelled", "expired"],
  frozen: ["active", "cancelled"],
  expired: ["active", "cancelled"], // "active" = renewal/extension path
  cancelled: [],
};

export function canTransition(from: MembershipStatus, to: MembershipStatus): boolean {
  return MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * DB-backed renewal pipeline stages (master prompt §30).
 * Derived from real rows only — never hard-coded.
 */
export type RenewalStage =
  | "upcoming"
  | "contacted"
  | "interested"
  | "payment_pending"
  | "renewed"
  | "expired";

export interface RenewalStageInput {
  expiry_date: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  has_follow_up: boolean;
  follow_up_outcome?: string | null;
  has_pending_renewal_order: boolean;
  has_paid_renewal_order: boolean;
}

export function deriveRenewalStage(input: RenewalStageInput): RenewalStage {
  const expired = input.expiry_date < input.today;
  if (input.has_paid_renewal_order) return "renewed";
  if (input.has_pending_renewal_order) return "payment_pending";
  if (expired) return "expired";
  if (input.has_follow_up) {
    return input.follow_up_outcome === "will_return" ? "interested" : "contacted";
  }
  return "upcoming";
}

export const RENEWAL_STAGES: RenewalStage[] = [
  "upcoming", "contacted", "interested", "payment_pending", "renewed", "expired",
];
