import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";

/** GET /api/users — application profiles for this gym (staff console). */
export async function GET() {
  try {
    const ctx = await requireAuth("staff.read");
    const { data, error } = await getServiceClient()
      .from("user_profiles")
      .select("id, clerk_user_id, gym_id, role, member_id, staff_id, created_at")
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}
