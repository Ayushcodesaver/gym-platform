import { z } from "zod";
import {
  ADD_ON_TYPES, FOLLOW_UP_CHANNELS, FOLLOW_UP_OUTCOMES,
} from "@gym/constants";

const uuid = z.string().uuid();
const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const createMemberSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().max(80).optional().nullable(),
  phone,
  email: z.string().email().optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  communication_consent: z.boolean().default(true),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema.partial().extend({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  assigned_trainer_id: uuid.nullable().optional(),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(120),
  duration_days: z.number().int().positive().max(3650),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  description: z.string().max(2000).optional().nullable(),
  benefits: z.array(z.string().max(200)).max(20).optional().nullable(),
});

export const createMembershipSchema = z.object({
  member_id: uuid,
  plan_id: uuid,
  start_date: z.string().date().default(() => new Date().toISOString().slice(0, 10)),
  /** Days to activate from payment: membership is created pending and activated on verification. */
});

export const membershipActionSchema = z.object({
  action: z.enum(["activate", "freeze", "unfreeze", "extend", "cancel"]),
  extend_days: z.number().int().positive().max(3650).optional(),
}).refine(
  (v) => v.action !== "extend" || v.extend_days !== undefined,
  { message: "extend_days is required for extend", path: ["extend_days"] },
);

export const qrCheckinSchema = z.object({ token: z.string().min(16).max(512) });

export const assistedCheckinSchema = z.object({
  member_id: uuid,
  source: z.enum(["assisted", "manual"]).default("assisted"),
});

export const createFollowUpSchema = z.object({
  member_id: uuid,
  channel: z.enum(FOLLOW_UP_CHANNELS),
  outcome: z.enum(FOLLOW_UP_OUTCOMES).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  next_action_at: z.string().datetime().optional().nullable(),
});

export const noShowActionSchema = z.object({
  action: z.enum(["assign", "start", "resolve", "cancel"]),
  assigned_staff_id: uuid.optional(),
});

export const createPaymentIntentSchema = z.object({
  member_id: uuid,
  plan_id: uuid,
  type: z.enum(["renewal", "add_on"]).default("renewal"),
  add_on_id: uuid.optional(),
  quantity: z.number().int().positive().max(50).default(1),
}).refine(
  (v) => v.type !== "add_on" || v.add_on_id !== undefined,
  { message: "add_on_id is required for add-on payments", path: ["add_on_id"] },
);

export const confirmAssistedPaymentSchema = z.object({
  payment_id: uuid,
  amount_paid: z.number().nonnegative(),
});

export const createAddOnSchema = createPlanSchema.omit({ duration_days: true }).extend({
  type: z.enum(ADD_ON_TYPES),
  duration: z.number().int().positive().max(3650).optional().nullable(),
  session_count: z.number().int().positive().max(1000).optional().nullable(),
  stock: z.number().int().nonnegative().optional().nullable(),
});

export const inviteStaffSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().max(80).optional().nullable(),
  phone: phone.optional().nullable(),
  role: z.enum(["manager", "front_desk"]),
});

export const updateSettingsSchema = z.object({
  attendance_settings: z.object({
    duplicate_checkin_minutes: z.number().int().min(15).max(1440).optional(),
  }).optional(),
  renewal_settings: z.object({ reminders_enabled: z.boolean().optional() }).optional(),
  notification_settings: z.record(z.boolean()).optional(),
  payment_settings: z.record(z.unknown()).optional(),
});

export const listQuerySchema = z.object({
  q: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Payment provider webhook (Razorpay-shaped, provider-agnostic contract). */
export const paymentWebhookSchema = z.object({
  event: z.string().max(80),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().min(1),
        order_id: z.string().min(1),
        amount: z.number().nonnegative(),
        status: z.string().max(40),
      }),
    }),
  }),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateAddOnSchema = createAddOnSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateStaffSchema = z.object({
  first_name: z.string().min(1).max(80).optional(),
  last_name: z.string().max(80).optional().nullable(),
  phone: phone.optional().nullable(),
  role: z.enum(["manager", "front_desk"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const createRefundSchema = z.object({
  payment_id: uuid,
  amount: z.number().positive().optional(), // defaults to full payment amount
  reason: z.string().max(500).optional().nullable(),
});

export const memberStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended", "deleted"]),
});

export const updateGymSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  no_show_threshold_days: z.number().int().min(1).max(365).optional(),
  operating_hours: z.record(z.unknown()).optional().nullable(),
  logo_url: z.string().max(1000).optional().nullable(),
});

export const markNotificationsReadSchema = z.object({
  notification_ids: z.array(uuid).max(100),
});

export const sellAddOnWalkInSchema = z.object({
  member_id: uuid,
  add_on_id: uuid,
  trainer_id: uuid.optional().nullable(),
  quantity: z.number().int().positive().max(50).default(1),
});
