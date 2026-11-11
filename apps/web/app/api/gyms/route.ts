import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updateGymSchema } from "@gym/validation";

/** GET /api/gyms — current tenant profile. */
export async function GET() {
  try {
    const ctx = await requireAuth("settings.read");
    const { data, error } = await getServiceClient()
      .from("gyms")
      .select("*")
      .eq("id", ctx.gymId)
      .single();
    if (error) throw error;
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/gyms — owner updates the gym profile (name, threshold, hours, logo). */
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth("settings.write");
    const body = updateGymSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("gyms")
      .update(body)
      .eq("id", ctx.gymId)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "SETTINGS_UPDATED", "gym", ctx.gymId, body as Record<string, unknown>);
    return ok(data, "Gym profile saved");
  } catch (e) {
    return handleError(e);
  }
}
