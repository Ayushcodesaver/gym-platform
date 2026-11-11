import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { updateStaffSchema } from "@gym/validation";

type Params = { params: { id: string } };

/** PATCH /api/staff/:id — edit staff, change role, deactivate (owner only for role). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("staff.write");
    const body = updateStaffSchema.parse(await req.json());
    if (body.role && ctx.role !== "owner") {
      return ok(null, "Only the owner can change roles", 403);
    }
    const db = getServiceClient();
    const { data, error } = await db
      .from("staff")
      .update(body)
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;

    if (body.role && data.user_profile_id) {
      await db.from("user_profiles").update({ role: body.role }).eq("id", data.user_profile_id);
    }
    await audit(ctx, body.role ? "ROLE_CHANGED" : "STAFF_UPDATED", "staff", params.id, body as Record<string, unknown>);
    return ok(data, "Staff updated");
  } catch (e) {
    return handleError(e);
  }
}
