import type {
  ADD_ON_TYPES, ATTENDANCE_SOURCES, FOLLOW_UP_CHANNELS, FOLLOW_UP_OUTCOMES,
  MEMBER_STATUSES, MEMBERSHIP_STATUSES, NO_SHOW_STATUSES, PAYMENT_STATUSES, Role,
} from "@gym/constants";

export type UUID = string;
type Enum<T extends readonly string[]> = T[number];

export interface Gym {
  id: UUID; clerk_organization_id: string; name: string; logo_url: string | null;
  phone: string | null; email: string | null; address: string | null;
  timezone: string; no_show_threshold_days: number; operating_hours: Record<string, unknown> | null;
  status: "active" | "suspended" | "deleted"; created_at: string; updated_at: string;
}

export interface UserProfile {
  id: UUID; clerk_user_id: string; gym_id: UUID | null; role: Role;
  member_id: UUID | null; staff_id: UUID | null; created_at: string; updated_at: string;
}

export interface Member {
  id: UUID; gym_id: UUID; user_profile_id: UUID | null; member_code: string;
  first_name: string; last_name: string | null; phone: string | null; email: string | null;
  date_of_birth: string | null; join_date: string; status: Enum<typeof MEMBER_STATUSES>;
  assigned_trainer_id: UUID | null; communication_consent: boolean;
  created_at: string; updated_at: string;
}

export interface Staff {
  id: UUID; gym_id: UUID; user_profile_id: UUID | null;
  first_name: string; last_name: string | null; phone: string | null;
  role: string; status: "active" | "inactive"; created_at: string; updated_at: string;
}

export interface Plan {
  id: UUID; gym_id: UUID; name: string; duration_days: number;
  price: number; discount: number; description: string | null;
  benefits: string[] | null; status: "active" | "inactive";
  created_at: string; updated_at: string;
}

export interface Membership {
  id: UUID; gym_id: UUID; member_id: UUID; plan_id: UUID;
  start_date: string; expiry_date: string;
  status: Enum<typeof MEMBERSHIP_STATUSES>;
  pause_start: string | null; pause_end: string | null;
  created_at: string; updated_at: string;
}

export interface QrSession {
  id: UUID; gym_id: UUID; token_hash: string;
  created_at: string; expires_at: string; status: "active" | "expired" | "revoked";
}

export interface Attendance {
  id: UUID; gym_id: UUID; member_id: UUID; qr_session_id: UUID | null;
  checked_in_at: string; source: Enum<typeof ATTENDANCE_SOURCES>;
  staff_id: UUID | null; correction_reason: string | null; created_at: string;
}

export interface Streak {
  id: UUID; gym_id: UUID; member_id: UUID;
  current_streak: number; best_streak: number;
  weekly_target: number; weekly_completed: number; updated_at: string;
}

export interface NoShowCase {
  id: UUID; gym_id: UUID; member_id: UUID; last_attendance_at: string | null;
  absent_days: number; status: Enum<typeof NO_SHOW_STATUSES>;
  assigned_staff_id: UUID | null; created_at: string; resolved_at: string | null;
}

export interface FollowUp {
  id: UUID; gym_id: UUID; member_id: UUID; staff_id: UUID | null;
  channel: Enum<typeof FOLLOW_UP_CHANNELS> | null;
  outcome: Enum<typeof FOLLOW_UP_OUTCOMES> | null;
  notes: string | null; next_action_at: string | null;
  created_at: string; updated_at: string;
}

export interface Payment {
  id: UUID; gym_id: UUID; member_id: UUID; membership_id: UUID | null;
  provider: string | null; provider_reference: string | null;
  amount: number; currency: "INR";
  status: Enum<typeof PAYMENT_STATUSES>; created_at: string; updated_at: string;
}

export interface RenewalOrder {
  id: UUID; gym_id: UUID; member_id: UUID; membership_id: UUID; plan_id: UUID;
  payment_id: UUID | null; amount: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  created_at: string; updated_at: string;
}

export interface AddOn {
  id: UUID; gym_id: UUID; name: string;
  type: Enum<typeof ADD_ON_TYPES>; description: string | null;
  price: number; duration: number | null; session_count: number | null;
  stock: number | null; status: "active" | "inactive";
  created_at: string; updated_at: string;
}

export interface AddOnOrder {
  id: UUID; gym_id: UUID; member_id: UUID; add_on_id: UUID;
  payment_id: UUID | null; trainer_id: UUID | null; quantity: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "fulfilled";
  sessions_remaining: number | null; created_at: string; updated_at: string;
}

export interface Notification {
  id: UUID; gym_id: UUID; member_id: UUID | null; type: string;
  title: string; body: string; channel: "push" | "email" | "sms" | "whatsapp";
  status: "pending" | "queued" | "sent" | "failed" | "cancelled";
  scheduled_at: string | null; sent_at: string | null; created_at: string;
}

export interface AuditLog {
  id: UUID; gym_id: UUID | null; user_profile_id: UUID | null;
  action: string; entity_type: string | null; entity_id: UUID | null;
  metadata: Record<string, unknown> | null; ip_address: string | null; created_at: string;
}

export interface GymSettings {
  id: UUID; gym_id: UUID;
  attendance_settings: { duplicate_checkin_minutes?: number } | null;
  renewal_settings: { reminders_enabled?: boolean } | null;
  notification_settings: Record<string, unknown> | null;
  payment_settings: Record<string, unknown> | null;
  created_at: string; updated_at: string;
}

/** Enriched rows used by the console UI. */
export interface MemberWithMembership extends Member {
  membership_status: Enum<typeof MEMBERSHIP_STATUSES> | null;
  plan_name: string | null;
  expiry_date: string | null;
  last_check_in_at: string | null;
}

/** Standard API envelopes (TRD §15). */
export interface ApiSuccess<T> { success: true; data: T; message?: string }
export interface ApiErrorBody { success: false; error: { code: string; message: string } }
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;
