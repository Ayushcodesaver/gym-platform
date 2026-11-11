import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { fail, handleError, ok } from "@/lib/api";
import { REMINDER_SCHEDULE_DAYS } from "@gym/constants";
import { markNotificationsReadSchema } from "@gym/validation";

/**
 * GET /api/notifications — member: own notifications; staff: gym-wide feed.
 * POST {"action":"process_renewal_reminders"} — idempotent reminder scheduling
 * (14/7/3/0 days, PRD §23): skips members already reminded for this expiry cycle,
 * already paid, cancelled, or opted out. Designed for a daily cron call.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return fail(401, "AUTHENTICATION_ERROR", "Sign in required");
    const db = getServiceClient();
    const { data: profile } = await db
      .from("user_profiles")
      .select("role, gym_id, member_id")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile) return fail(403, "AUTHORIZATION_ERROR", "No profile");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    let query = db
      .from("notifications")
      .select("id, type, title, body, channel, status, created_at, sent_at, member_id, members(first_name, last_name, member_code)")
      .eq("gym_id", profile.gym_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (profile.role === "member") query = query.eq("member_id", profile.member_id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/notifications — reminder processing (cron) with per-cycle dedupe. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action !== "process_renewal_reminders") {
      return fail(422, "VALIDATION_ERROR", "Unknown action");
    }
    const db = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    for (const offset of REMINDER_SCHEDULE_DAYS) {
      const targetDate = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
      const type = offset === 0 ? "RENEWAL_EXPIRY" : `RENEWAL_REMINDER_${offset}D`;

      const { data: due } = await db
        .from("memberships")
        .select("id, member_id, gym_id, members(communication_consent)")
        .eq("status", "active")
        .eq("expiry_date", targetDate);
      for (const m of due ?? []) {
        const consent = (m.members as { communication_consent?: boolean } | null)?.communication_consent ?? true;
        if (!consent) continue;

        // Already paid for this cycle? (a renewal_order paid after creation)
        const { count: paidCount } = await db
          .from("renewal_orders")
          .select("id", { count: "exact", head: true })
          .eq("membership_id", m.id)
          .eq("status", "paid");
        if ((paidCount ?? 0) > 0) continue;

        // Dedupe: one reminder of this type per membership per target date
        const { count: existing } = await db
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("type", type)
          .eq("member_id", m.member_id)
          .gte("created_at", `${today}T00:00:00Z`)
          .lt("created_at", `${today}T23:59:59Z`);
        if ((existing ?? 0) > 0) continue;

        const { error } = await db.from("notifications").insert({
          gym_id: m.gym_id,
          member_id: m.member_id,
          type,
          title: offset === 0 ? "Membership expires today" : `Membership expires in ${offset} days`,
          body: offset === 0
            ? "Your membership expires today. Renew at the front desk or in the app."
            : `Renew before ${targetDate} to keep your streak going.`,
          channel: "push",
          status: "queued",
          scheduled_at: new Date().toISOString(),
        });
        if (!error) created += 1;
      }
    }
    return ok({ created }, `Reminders scheduled: ${created}`);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/notifications — mark member notifications processed/sent. */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return fail(401, "AUTHENTICATION_ERROR", "Sign in required");
    const body = markNotificationsReadSchema.parse(await req.json());
    const db = getServiceClient();
    const { data: profile } = await db
      .from("user_profiles")
      .select("role, gym_id, member_id")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile) return fail(403, "AUTHORIZATION_ERROR", "No profile");

    let query = db
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", body.notification_ids)
      .eq("gym_id", profile.gym_id);
    if (profile.role === "member") query = query.eq("member_id", profile.member_id);

    const { error } = await query;
    if (error) throw error;
    return ok({ updated: body.notification_ids.length });
  } catch (e) {
    return handleError(e);
  }
}
