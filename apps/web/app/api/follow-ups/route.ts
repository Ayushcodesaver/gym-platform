import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createFollowUpSchema } from "@gym/validation";

/** GET /api/follow-ups?member_id= — follow-up log. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("followups.read");
    const url = new URL(req.url);
    const { from, to } = pageParams(url, 50);
    const memberId = url.searchParams.get("member_id");
    const db = getServiceClient();
    let query = db
      .from("follow_ups")
      .select("*, members(first_name, last_name, member_code), staff(first_name, last_name)")
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (memberId) query = query.eq("member_id", memberId);
    const { data, error } = await query;
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/follow-ups — record an outreach (channel, outcome, notes, next action). */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("followups.write");
    const body = createFollowUpSchema.parse(await req.json());
    const db = getServiceClient();
    const { data, error } = await db
      .from("follow_ups")
      .insert({ ...body, gym_id: ctx.gymId, staff_id: ctx.profile.staff_id })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "FOLLOW_UP_CREATED", "follow_up", data.id, { member_id: body.member_id });
    return ok(data, "Follow-up recorded", 201);
  } catch (e) {
    return handleError(e);
  }
}
