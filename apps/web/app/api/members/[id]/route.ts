import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updateMemberSchema } from "@gym/validation";

type Params = { params: { id: string } };

/** GET /api/members/:id — profile + membership + attendance + payments + follow-ups. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("members.read");
    const db = getServiceClient();
    const id = params.id;
    const [member, memberships, attendance, payments, followUps, streak] = await Promise.all([
      db.from("members").select("*").eq("gym_id", ctx.gymId).eq("id", id).maybeSingle(),
      db.from("memberships").select("*, plans(name, price, duration_days)")
        .eq("gym_id", ctx.gymId).eq("member_id", id).order("created_at", { ascending: false }),
      db.from("attendance").select("id, checked_in_at, source")
        .eq("gym_id", ctx.gymId).eq("member_id", id).order("checked_in_at", { ascending: false }).limit(50),
      db.from("payments").select("id, amount, status, created_at")
        .eq("gym_id", ctx.gymId).eq("member_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("follow_ups").select("*")
        .eq("gym_id", ctx.gymId).eq("member_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("streaks").select("*").eq("gym_id", ctx.gymId).eq("member_id", id).maybeSingle(),
    ]);
    if (!member.data) return ok(null, "Member not found", 404);
    return ok({
      member: member.data,
      memberships: memberships.data ?? [],
      attendance: attendance.data ?? [],
      payments: payments.data ?? [],
      followUps: followUps.data ?? [],
      streak: streak.data ?? null,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/members/:id — edit profile / status. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("members.write");
    const body = updateMemberSchema.parse(await req.json());
    const db = getServiceClient();
    const { data, error } = await db
      .from("members")
      .update(body)
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "MEMBER_UPDATED", "member", params.id, body as Record<string, unknown>);
    return ok(data, "Member updated");
  } catch (e) {
    return handleError(e);
  }
}
