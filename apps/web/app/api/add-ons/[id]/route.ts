import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updateAddOnSchema } from "@gym/validation";

type Params = { params: { id: string } };

/** PATCH /api/add-ons/:id — edit / deactivate a catalogue item. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("addons.write");
    const body = updateAddOnSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("add_ons")
      .update(body)
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "ADDON_UPDATED", "add_on", params.id, body as Record<string, unknown>);
    return ok(data, "Add-on updated");
  } catch (e) {
    return handleError(e);
  }
}
