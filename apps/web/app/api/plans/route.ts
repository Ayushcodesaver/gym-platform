import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createPlanSchema } from "@gym/validation";

/** GET /api/plans — plan catalogue for this gym. */
export async function GET() {
  try {
    const ctx = await requireAuth("memberships.read");
    const { data, error } = await getServiceClient()
      .from("plans")
      .select("*")
      .eq("gym_id", ctx.gymId)
      .order("price", { ascending: true });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/plans — create a plan. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("memberships.write");
    const body = createPlanSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("plans")
      .insert({ ...body, gym_id: ctx.gymId })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "PLAN_CREATED", "plan", data.id, { name: body.name });
    return ok(data, "Plan created", 201);
  } catch (e) {
    return handleError(e);
  }
}
