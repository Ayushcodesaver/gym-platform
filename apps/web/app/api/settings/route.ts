import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updateSettingsSchema } from "@gym/validation";

/** GET /api/settings — gym profile + gym-level settings. */
export async function GET() {
  try {
    const ctx = await requireAuth("settings.read");
    const db = getServiceClient();
    const [{ data: gym }, { data: settings }] = await Promise.all([
      db.from("gyms").select("*").eq("id", ctx.gymId).single(),
      db.from("settings").select("*").eq("gym_id", ctx.gymId).maybeSingle(),
    ]);
    return ok({ gym, settings });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/settings — update settings (backend-validated JSONB, docs §40). */
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth("settings.write");
    const body = updateSettingsSchema.parse(await req.json());
    const db = getServiceClient();
    const { data, error } = await db
      .from("settings")
      .upsert({ gym_id: ctx.gymId, ...body }, { onConflict: "gym_id" })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "SETTINGS_UPDATED", "settings", ctx.gymId, body as Record<string, unknown>);
    return ok(data, "Settings saved");
  } catch (e) {
    return handleError(e);
  }
}
