import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updatePlanSchema } from "@gym/validation";

type Params = { params: { id: string } };

/** PATCH /api/plans/:id — edit / deactivate a plan (owner/manager). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("memberships.write");
    const body = updatePlanSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("plans")
      .update(body)
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "PLAN_UPDATED", "plan", params.id, body as Record<string, unknown>);
    return ok(data, "Plan updated");
  } catch (e) {
    return handleError(e);
  }
}
