/** Roles. Clerk org role maps to one of these (PRD §6). */
export const ROLES = ["owner", "manager", "front_desk", "member"] as const;
export type Role = (typeof ROLES)[number];

/** Permission strings. `*` = all actions within a resource. */
export type Permission =
  | "dashboard.read"
  | "members.read" | "members.write"
  | "attendance.read" | "attendance.write"
  | "memberships.read" | "memberships.write"
  | "renewals.read" | "renewals.write"
  | "payments.read" | "payments.write" | "payments.confirm"
  | "followups.read" | "followups.write"
  | "addons.read" | "addons.write"
  | "reports.read"
  | "staff.read" | "staff.write"
  | "settings.read" | "settings.write"
  | "receipts.create";

/** Permission → role matrix. Member role is handled separately (own data only). */
export const ROLE_PERMISSIONS: Record<Exclude<Role, "member">, Permission[]> = {
  owner: [
    "dashboard.read", "members.read", "members.write", "attendance.read", "attendance.write",
    "memberships.read", "memberships.write", "renewals.read", "renewals.write",
    "payments.read", "payments.write", "payments.confirm", "followups.read", "followups.write",
    "addons.read", "addons.write", "reports.read", "staff.read", "staff.write",
    "settings.read", "settings.write", "receipts.create",
  ],
  manager: [
    "dashboard.read", "members.read", "members.write", "attendance.read", "attendance.write",
    "memberships.read", "memberships.write", "renewals.read", "renewals.write",
    "payments.read", "payments.write", "followups.read", "followups.write",
    "addons.read", "addons.write", "reports.read", "staff.read", "settings.read",
  ],
  front_desk: [
    "dashboard.read", "members.read", "members.write", "attendance.read", "attendance.write",
    "memberships.read", "renewals.read", "payments.read", "payments.confirm", "receipts.create",
    "addons.read",
  ],
};

export const MEMBERSHIP_STATUSES = ["pending", "active", "frozen", "expired", "cancelled"] as const;
export const PAYMENT_STATUSES = ["created", "pending", "paid", "failed", "refunded", "reversed"] as const;
export const MEMBER_STATUSES = ["active", "inactive", "suspended", "deleted"] as const;
export const NO_SHOW_STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const;
export const FOLLOW_UP_OUTCOMES = [
  "will_return", "injured", "travelling", "timing_issue", "unhappy", "no_response", "cancelled",
] as const;
export const FOLLOW_UP_CHANNELS = ["call", "whatsapp", "sms", "email", "in_person"] as const;
export const ATTENDANCE_SOURCES = ["qr", "assisted", "manual"] as const;
export const ADD_ON_TYPES = ["pt", "diet", "product", "supplement", "service"] as const;

export const DEFAULT_NO_SHOW_THRESHOLD_DAYS = 10;
/** Duplicate check-in window (minutes) — configurable per gym in settings. */
export const DEFAULT_DUPLICATE_CHECKIN_MINUTES = 120;
/** Renewal reminder offsets in days before expiry (PRD §23). */
export const REMINDER_SCHEDULE_DAYS = [14, 7, 3, 0] as const;

/** Error codes (TRD §49). Never expose internals to clients. */
export const ERROR_CODES = {
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYMENT_ERROR: "PAYMENT_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  MEMBERSHIP_EXPIRED: "MEMBERSHIP_EXPIRED",
  MEMBERSHIP_FROZEN: "MEMBERSHIP_FROZEN",
  DUPLICATE_CHECKIN: "DUPLICATE_CHECKIN",
  INVALID_QR: "INVALID_QR",
  GYM_MISMATCH: "GYM_MISMATCH",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Centralized user-facing copy (master prompt §68).
 * All new user-visible strings route through here so i18n can be layered later
 * without touching business logic.
 */
export const STRINGS = {
  errors: {
    sign_in_required: "Sign in required",
    no_permission: "You do not have permission to do that",
    not_found: "Not found",
    network: "Network error — check your connection and try again.",
    generic: "Something went wrong. Please try again.",
    invalid_qr: "QR code is invalid or expired",
    duplicate_checkin: "Already checked in recently",
    membership_expired: "Membership has expired",
    membership_frozen: "Membership is frozen",
    payment_pending_title: "Payment pending",
    payment_pending_body:
      "We'll confirm as soon as the payment gateway verifies it. You can close this screen.",
  },
  success: {
    member_added: "Member added",
    member_updated: "Member updated",
    checked_in: "Check-in complete",
    payment_confirmed: "Payment confirmed",
    settings_saved: "Settings saved",
  },
} as const;

