import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { deriveRenewalStage } from "@gym/constants/membership-transitions";

/**
 * GET /api/renewals — DB-backed renewal pipeline (master prompt §30).
 * Stages derive from real rows: memberships + renewal_orders + follow_ups.
 * Everything expires within the next 30 days (or already expired).
 */
export async function GET() {
  try {
    const ctx = await requireAuth("renewals.read");
    const db = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const [memberships, orders, followUps] = await Promise.all([
      db
        .from("memberships")
        .select("id, member_id, plan_id, status, start_date, expiry_date, members(first_name, last_name, member_code, phone), plans(name, price, discount)")
        .eq("gym_id", ctx.gymId)
        .in("status", ["active", "frozen", "pending"])
        .lte("expiry_date", horizon)
        .order("expiry_date", { ascending: true }),
      db.from("renewal_orders").select("membership_id, status").eq("gym_id", ctx.gymId),
      db.from("follow_ups").select("member_id, outcome").eq("gym_id", ctx.gymId),
    ]);
    if (memberships.error) throw memberships.error;

    const pendingOrders = new Set((orders.data ?? []).filter((o) => o.status === "pending").map((o) => o.membership_id));
    const paidOrders = new Set((orders.data ?? []).filter((o) => o.status === "paid").map((o) => o.membership_id));
    const followUpByMember = new Map<string, string | null>();
    for (const f of followUps.data ?? []) {
      if (!followUpByMember.has(f.member_id)) followUpByMember.set(f.member_id, f.outcome);
    }

    const pipeline = (memberships.data ?? []).map((m) => {
      const stage = deriveRenewalStage({
        expiry_date: m.expiry_date,
        today,
        has_follow_up: followUpByMember.has(m.member_id),
        follow_up_outcome: followUpByMember.get(m.member_id) ?? null,
        has_pending_renewal_order: pendingOrders.has(m.id),
        has_paid_renewal_order: paidOrders.has(m.id),
      });
      return { ...m, stage };
    });

    const byStage = Object.fromEntries(
      ["upcoming", "contacted", "interested", "payment_pending", "renewed", "expired"].map((s) => [
        s,
        pipeline.filter((p) => p.stage === s).length,
      ]),
    );
    return ok({ pipeline, byStage, today });
  } catch (e) {
    return handleError(e);
  }
}
