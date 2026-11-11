import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { ROLE_PERMISSIONS } from "@gym/constants";

/**
 * GET /api/auth — whoami for the console: profile, gym, resolved permissions.
 * Used by the role-aware sidebar (master prompt §39) — never trusts client role.
 */
export async function GET() {
  try {
    const ctx = await requireAuth("dashboard.read");
    const permissions = ROLE_PERMISSIONS[ctx.role as Exclude<typeof ctx.role, "member">] ?? [];
    const { data: gym } = await getServiceClient()
      .from("gyms")
      .select("id, name, logo_url")
      .eq("id", ctx.gymId)
      .single();
    return ok({
      profile: { id: ctx.profile.id, role: ctx.role, clerk_user_id: ctx.clerkUserId },
      gym,
      permissions,
    });
  } catch (e) {
    return handleError(e);
  }
}
