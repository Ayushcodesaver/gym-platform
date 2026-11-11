import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createAddOnSchema } from "@gym/validation";

/** GET /api/add-ons — catalogue (staff view). */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("addons.read");
    const url = new URL(req.url);
    const { from, to } = pageParams(url, 50);
    const { data, error } = await getServiceClient()
      .from("add_ons")
      .select("*")
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/add-ons — create catalogue item. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("addons.write");
    const body = createAddOnSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("add_ons")
      .insert({ ...body, gym_id: ctx.gymId })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "ADDON_CREATED", "add_on", data.id, { name: body.name });
    return ok(data, "Add-on created", 201);
  } catch (e) {
    return handleError(e);
  }
}
