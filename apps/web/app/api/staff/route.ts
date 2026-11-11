import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { inviteStaffSchema } from "@gym/validation";

/** GET /api/staff — staff directory (staff table + linked user_profiles roles). */
export async function GET() {
  try {
    const ctx = await requireAuth("staff.read");
    const { data, error } = await getServiceClient()
      .from("staff")
      .select("*, user_profiles(role, clerk_user_id)")
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/staff — record staff + create an invitation. Clerk organization
 * invitation is issued client-side via Clerk components; this endpoint persists
 * the staff row. Access begins only when the org membership exists (PRD §14).
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("staff.write");
    const body = inviteStaffSchema.parse(await req.json());
    const { data, error } = await getServiceClient()
      .from("staff")
      .insert({ ...body, gym_id: ctx.gymId })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "STAFF_CREATED", "staff", data.id, { role: body.role });
    return ok(data, "Staff added — send the Clerk organization invite next", 201);
  } catch (e) {
    return handleError(e);
  }
}
