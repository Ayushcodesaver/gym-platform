import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createMembershipSchema } from "@gym/validation";

/** GET /api/memberships?status= — membership list with member + plan. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("memberships.read");
    const url = new URL(req.url);
    const { from, to, page, pageSize } = pageParams(url);
    const status = url.searchParams.get("status");
    const db = getServiceClient();
    let query = db
      .from("memberships")
      .select("*, members(first_name, last_name, member_code), plans(name)", { count: "exact" })
      .eq("gym_id", ctx.gymId)
      .order("expiry_date", { ascending: true })
      .range(from, to);
    if (status) query = query.eq("status", status);
    const { data, count, error } = await query;
    if (error) throw error;
    return ok({ memberships: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/memberships — create a PENDING membership (activated only after
 * verified payment; PRD §16). Validates member + plan belong to this gym
 * (composite FKs re-check at the DB level).
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("memberships.write");
    const body = createMembershipSchema.parse(await req.json());
    const db = getServiceClient();

    const { data: plan } = await db
      .from("plans")
      .select("duration_days")
      .eq("gym_id", ctx.gymId)
      .eq("id", body.plan_id)
      .single();
    if (!plan) return ok(null, "Plan not found in this gym", 404);

    const start = new Date(body.start_date + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() + plan.duration_days);
    const expiry = start.toISOString().slice(0, 10);

    const { data, error } = await db
      .from("memberships")
      .insert({
        gym_id: ctx.gymId,
        member_id: body.member_id,
        plan_id: body.plan_id,
        start_date: body.start_date,
        expiry_date: expiry,
        status: "pending",
      })
      .select("*, plans(name)")
      .single();
    if (error) throw error;
    await audit(ctx, "MEMBERSHIP_CREATED", "membership", data.id, { plan_id: body.plan_id });
    return ok(data, "Membership created (pending payment)", 201);
  } catch (e) {
    return handleError(e);
  }
}
