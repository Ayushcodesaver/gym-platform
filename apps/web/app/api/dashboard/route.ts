import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard — KPIs + action center (PRD §17).
 * All aggregates scoped to the authenticated gym, computed server-side (docs §66).
 */
export async function GET() {
  try {
    const ctx = await requireAuth("dashboard.read");
    const db = getServiceClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [members, active, checkinsToday, active7, expiring, revenue, addons, followups, failedPayments, redList] =
      await Promise.all([
        db.from("members").select("id", { count: "exact", head: true })
          .eq("gym_id", ctx.gymId).neq("status", "deleted"),
        db.from("memberships").select("id", { count: "exact", head: true })
          .eq("gym_id", ctx.gymId).eq("status", "active").gte("expiry_date", today),
        db.from("attendance").select("id", { count: "exact", head: true })
          .eq("gym_id", ctx.gymId).gte("checked_in_at", todayStart.toISOString()),
        db.from("attendance").select("member_id", { count: "exact", head: true })
          .eq("gym_id", ctx.gymId).gte("checked_in_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
        db.from("memberships").select("id, expiry_date, members(first_name, last_name, member_code), plans(name)")
          .eq("gym_id", ctx.gymId).in("status", ["active", "frozen"])
          .lte("expiry_date", in14).gte("expiry_date", today).order("expiry_date").limit(10),
        db.from("payments").select("amount").eq("gym_id", ctx.gymId).eq("status", "paid")
          .gte("created_at", monthStart.toISOString()),
        db.from("add_on_orders").select("id, add_ons(name), payment_id, status", { count: "exact" })
          .eq("gym_id", ctx.gymId).eq("status", "pending").limit(5),
        db.from("no_show_cases").select("*, members(first_name, last_name, member_code, phone)")
          .eq("gym_id", ctx.gymId).in("status", ["open", "in_progress"]).order("absent_days", { ascending: false }).limit(10),
        db.from("payments").select("id, amount, members(first_name, last_name, member_code)")
          .eq("gym_id", ctx.gymId).eq("status", "failed").limit(10),
        db.from("memberships").select("id, member_id").eq("gym_id", ctx.gymId).eq("status", "active"),
      ]);

    const revenueMonth = (revenue.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const activeIds = new Set((redList.data ?? []).map((r) => r.member_id));

    return ok({
      kpis: {
        totalMembers: members.count ?? 0,
        activeMembers: active.count ?? 0,
        checkinsToday: checkinsToday.count ?? 0,
        active7d: active7.count ?? 0,
        revenueMonth,
      },
      expiringSoon: expiring.data ?? [],
      actionCenter: {
        noShowCases: followups.data ?? [],
        failedPayments: failedPayments.data ?? [],
        pendingAddonOrders: addons.data ?? [],
        activeMemberIds: [...activeIds],
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
