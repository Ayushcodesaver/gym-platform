import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { memberStatusSchema } from "@gym/validation";

type Params = { params: { id: string } };

/**
 * POST /api/members/:id/status — deactivate (inactive/suspended/deleted) or
 * restore (active). Financial + attendance history is preserved: `deleted`
 * members stay in the database with their history (docs §47 delete strategy).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("members.write");
    const body = memberStatusSchema.parse(await req.json());
    const db = getServiceClient();
    const { data, error } = await db
      .from("members")
      .update({ status: body.status })
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, `MEMBER_${body.status.toUpperCase()}`, "member", params.id, { status: body.status });
    return ok(data, `Member marked ${body.status}`);
  } catch (e) {
    return handleError(e);
  }
}
