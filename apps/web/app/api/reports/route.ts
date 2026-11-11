import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/reports?range=30 — attendance trend, membership mix, revenue, retention.
 * Server-side aggregation only (docs/database.md §65–66).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("reports.read");
    const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("range") ?? 30) || 30));
    const db = getServiceClient();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [attendance, memberships, revenue, retention] = await Promise.all([
      db.from("attendance").select("checked_in_at").eq("gym_id", ctx.gymId).gte("checked_in_at", since),
      db.from("memberships").select("status, count", { count: "exact" })
        .eq("gym_id", ctx.gymId)
        .select("status"),
      db.from("payments").select("amount, created_at, status").eq("gym_id", ctx.gymId)
        .gte("created_at", since).in("status", ["paid", "refunded"]),
      db.from("no_show_cases").select("status, absent_days").eq("gym_id", ctx.gymId).gte("created_at", since),
    ]);

    // Attendance per day
    const perDay = new Map<string, number>();
    for (const a of attendance.data ?? []) {
      const d = a.checked_in_at.slice(0, 10);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    const attendanceTrend = [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Membership status mix
    const mix = new Map<string, number>();
    for (const m of memberships.data ?? []) mix.set(m.status, (mix.get(m.status) ?? 0) + 1);

    // Revenue per day (paid only; refunds recorded separately)
    const revPerDay = new Map<string, number>();
    for (const p of revenue.data ?? []) {
      if (p.status !== "paid") continue;
      const d = p.created_at.slice(0, 10);
      revPerDay.set(d, (revPerDay.get(d) ?? 0) + Number(p.amount));
    }
    const revenueTrend = [...revPerDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));

    const resolved = (retention.data ?? []).filter((c) => c.status === "resolved").length;
    const total = (retention.data ?? []).length;

    return ok({
      range: days,
      attendanceTrend,
      revenueTrend,
      membershipMix: Object.fromEntries(mix),
      retention: {
        cases: total,
        resolved,
        resolvedRate: total ? Math.round((resolved / total) * 100) : 100,
        atRiskToday: (retention.data ?? []).filter((c) => c.status !== "resolved" && c.status !== "cancelled").length,
        today,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
