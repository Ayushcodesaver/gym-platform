import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { findActiveQrSession } from "@/lib/qr";
import { performCheckIn } from "@/lib/attendance";
import { rateLimit } from "@/lib/rate-limit";
import { fail, handleError, ok } from "@/lib/api";
import { qrCheckinSchema } from "@gym/validation";

/**
 * POST /api/qr/checkin — member mobile check-in (PRD §20 flow).
 * Identity: Clerk session token → user_profiles(member). Gym: from the QR
 * session, NOT from the client. Membership + duplicate checks run inside
 * performCheckIn. A member can only ever check into their own gym.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "qr-checkin", { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return fail(429, "RATE_LIMIT_ERROR", "Too many attempts. Try again shortly.");
  try {
    const { userId } = auth();
    if (!userId) return fail(401, "AUTHENTICATION_ERROR", "Sign in required");
    const body = qrCheckinSchema.parse(await req.json());

    const db = getServiceClient();
    const { data: profile } = await db
      .from("user_profiles")
      .select("id, role, gym_id, member_id")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile || profile.role !== "member" || !profile.member_id) {
      return fail(403, "AUTHORIZATION_ERROR", "Member profile not linked");
    }

    const qr = await findActiveQrSession(body.token);
    if (!qr.ok || !qr.gymId) return fail(400, "INVALID_QR", "QR code is invalid or expired");
    if (profile.gym_id !== qr.gymId) {
      return fail(403, "GYM_MISMATCH", "This QR belongs to a different gym");
    }

    const { data: settings } = await db
      .from("settings")
      .select("attendance_settings")
      .eq("gym_id", qr.gymId)
      .maybeSingle();
    const duplicateWindow =
      (settings?.attendance_settings as { duplicate_checkin_minutes?: number } | null)
        ?.duplicate_checkin_minutes ?? 120;

    const result = await performCheckIn(
      qr.gymId,
      profile.member_id,
      "qr",
      null,
      qr.sessionId,
      duplicateWindow,
    );
    return ok(result, "Check-in complete");
  } catch (e) {
    return handleError(e);
  }
}
