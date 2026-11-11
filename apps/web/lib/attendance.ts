import { getServiceClient } from "@/lib/supabase/server";
import { ERROR_CODES } from "@gym/constants";
import { HttpError } from "@/lib/auth";

export interface CheckInResult {
  attendanceId: string;
  checkedInAt: string;
  streak: { current_streak: number; best_streak: number; weekly_completed: number; weekly_target: number };
}

const SAME_DAY = (a: Date) => {
  const [y, m, d] = [a.getFullYear(), a.getMonth(), a.getDate()];
  return (b: Date) => b.getFullYear() === y && b.getMonth() === m && b.getDate() === d;
};

/**
 * Core check-in pipeline (PRD §20): membership gates → duplicate window →
 * attendance row → streak update → resolve open no-show cases. Runs server-side
 * with the service-role key; the caller has already authenticated the member.
 */
export async function performCheckIn(
  gymId: string,
  memberId: string,
  source: "qr" | "assisted" | "manual",
  staffId: string | null,
  qrSessionId: string | null,
  duplicateWindowMinutes: number,
): Promise<CheckInResult> {
  const db = getServiceClient();

  // 1) Member exists in THIS gym
  const { data: member, error: memberErr } = await db
    .from("members")
    .select("id, status")
    .eq("gym_id", gymId)
    .eq("id", memberId)
    .single();
  if (memberErr || !member) throw new HttpError(404, ERROR_CODES.NOT_FOUND, "Member not found in this gym");
  if (member.status !== "active") {
    throw new HttpError(409, ERROR_CODES.CONFLICT, "Member is not active");
  }

  // 2) Membership gates: active, not frozen, not expired (TRD §43)
  const today = new Date().toISOString().slice(0, 10);
  const { data: membership } = await db
    .from("memberships")
    .select("id, status, expiry_date")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .in("status", ["active", "frozen"])
    .order("expiry_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    throw new HttpError(409, ERROR_CODES.MEMBERSHIP_EXPIRED, "No active membership found");
  }
  if (membership.status === "frozen") {
    throw new HttpError(409, ERROR_CODES.MEMBERSHIP_FROZEN, "Membership is frozen");
  }
  if (membership.expiry_date < today) {
    throw new HttpError(409, ERROR_CODES.MEMBERSHIP_EXPIRED, "Membership has expired");
  }

  // 3) Duplicate window (TRD §42): 409 CONFLICT, not silent success
  const since = new Date(Date.now() - duplicateWindowMinutes * 60_000).toISOString();
  const { data: dupe } = await db
    .from("attendance")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .gte("checked_in_at", since)
    .limit(1)
    .maybeSingle();
  if (dupe) {
    throw new HttpError(409, ERROR_CODES.DUPLICATE_CHECKIN, "Already checked in recently");
  }

  // 4) Record attendance
  const { data: attendance, error: attErr } = await db
    .from("attendance")
    .insert({ gym_id: gymId, member_id: memberId, qr_session_id: qrSessionId, source, staff_id: staffId })
    .select("id, checked_in_at")
    .single();
  if (attErr || !attendance) throw attErr ?? new Error("attendance insert failed");

  // 5) Streak: consecutive days; weekly completion within Mon–Sun week
  const { data: streak } = await db
    .from("streaks")
    .select("*")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .maybeSingle();

  const now = new Date();
  const checkedSameDay = streak
    ? SAME_DAY(new Date(streak.updated_at))(now) // last touch today → streak already counted
    : false;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const checkedYesterday = streak ? SAME_DAY(new Date(streak.updated_at))(yesterday) : false;

  const currentStreak = checkedSameDay
    ? Math.max(streak?.current_streak ?? 1, 1)
    : checkedYesterday
      ? (streak?.current_streak ?? 0) + 1
      : 1;
  const bestStreak = Math.max(streak?.best_streak ?? 0, currentStreak);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  const { count: weeklyCount } = await db
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .gte("checked_in_at", weekStart.toISOString());

  if (streak) {
    await db
      .from("streaks")
      .update({
        current_streak: currentStreak,
        best_streak: bestStreak,
        weekly_completed: weeklyCount ?? 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", streak.id);
  } else {
    await db.from("streaks").insert({
      gym_id: gymId,
      member_id: memberId,
      current_streak: currentStreak,
      best_streak: bestStreak,
      weekly_completed: weeklyCount ?? 1,
    });
  }

  // 6) Resolve open no-show cases on return (PRD §21)
  await db
    .from("no_show_cases")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .in("status", ["open", "in_progress"]);

  return {
    attendanceId: attendance.id,
    checkedInAt: attendance.checked_in_at,
    streak: {
      current_streak: currentStreak,
      best_streak: bestStreak,
      weekly_completed: weeklyCount ?? 1,
      weekly_target: 3,
    },
  };
}

/** Daily no-show scan body (PRD §21, TRD §44). Called by cron/scheduled function. */
export async function runNoShowScan(gymId: string, thresholdDays: number) {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const { data: actives } = await db
    .from("memberships")
    .select("member_id")
    .eq("gym_id", gymId)
    .eq("status", "active")
    .gte("expiry_date", today);
  const activeIds = (actives ?? []).map((r) => r.member_id);
  if (activeIds.length === 0) return { created: 0 };

  // Latest attendance per active member
  const { data: lastVisits } = await db
    .from("attendance")
    .select("member_id, checked_in_at")
    .eq("gym_id", gymId)
    .in("member_id", activeIds)
    .order("checked_in_at", { ascending: false });

  const latest = new Map<string, string>();
  for (const v of lastVisits ?? []) {
    if (!latest.has(v.member_id)) latest.set(v.member_id, v.checked_in_at);
  }

  // Members with no open case whose absence exceeds the threshold
  const { data: openCases } = await db
    .from("no_show_cases")
    .select("member_id")
    .eq("gym_id", gymId)
    .in("status", ["open", "in_progress"]);
  const hasOpenCase = new Set((openCases ?? []).map((r) => r.member_id));

  const rows = activeIds
    .filter((id) => !hasOpenCase.has(id))
    .map((id) => {
      const last = latest.get(id);
      if (last && new Date(last).getTime() >= new Date(cutoff).getTime()) return null;
      const lastDate = last ? new Date(last) : null;
      const absent = lastDate
        ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
        : 999;
      return {
        gym_id: gymId,
        member_id: id,
        last_attendance_at: last,
        absent_days: absent,
        status: "open",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) await db.from("no_show_cases").insert(rows);
  return { created: rows.length };
}
