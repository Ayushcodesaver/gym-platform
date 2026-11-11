import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { fail, handleError, ok } from "@/lib/api";
import type { Member, Membership, Payment, Streak } from "@gym/types";

/**
 * GET /api/members/me — member mobile app home data.
 * Identity: Clerk session → user_profiles(role=member). Members can only ever
 * read their own rows; the gym scope comes from the profile, not the client.
 */
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return fail(401, "AUTHENTICATION_ERROR", "Sign in required");
    const db = getServiceClient();

    const { data: profile } = await db
      .from("user_profiles")
      .select("id, role, gym_id, member_id")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile || profile.role !== "member" || !profile.member_id) {
      return fail(403, "AUTHORIZATION_ERROR", "No member profile is linked to this account");
    }

    const [member, memberships, payments, streak, attendance] = await Promise.all([
      db.from("members").select("*").eq("gym_id", profile.gym_id).eq("id", profile.member_id).single(),
      db.from("memberships").select("*, plans(name, price)").eq("gym_id", profile.gym_id)
        .eq("member_id", profile.member_id).order("expiry_date", { ascending: false }),
      db.from("payments").select("id, amount, status, created_at").eq("gym_id", profile.gym_id)
        .eq("member_id", profile.member_id).order("created_at", { ascending: false }).limit(20),
      db.from("streaks").select("*").eq("gym_id", profile.gym_id).eq("member_id", profile.member_id).maybeSingle(),
      db.from("attendance").select("checked_in_at").eq("gym_id", profile.gym_id)
        .eq("member_id", profile.member_id).order("checked_in_at", { ascending: false }).limit(14),
    ]);
    if (!member.data) return fail(404, "NOT_FOUND", "Member not found in this gym");

    return ok({
      member: member.data as Member,
      memberships: (memberships.data ?? []) as Membership[],
      payments: (payments.data ?? []) as Payment[],
      streak: (streak.data ?? null) as Streak | null,
      recentCheckIns: (attendance.data ?? []).map((a) => a.checked_in_at),
    });
  } catch (e) {
    return handleError(e);
  }
}
