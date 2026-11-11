import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { assistedCheckinSchema } from "@gym/validation";
import { performCheckIn } from "@/lib/attendance";

/** GET /api/attendance?member_id=&page= — today board + history. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("attendance.read");
    const url = new URL(req.url);
    const { from, to, page, pageSize } = pageParams(url);
    const memberId = url.searchParams.get("member_id");
    const db = getServiceClient();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let query = db
      .from("attendance")
      .select("*, members(first_name, last_name, member_code)", { count: "exact" })
      .eq("gym_id", ctx.gymId)
      .order("checked_in_at", { ascending: false })
      .range(from, to);
    if (memberId) query = query.eq("member_id", memberId);

    const [{ data, count, error }, todayRes] = await Promise.all([
      query,
      db
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", ctx.gymId)
        .gte("checked_in_at", startOfDay.toISOString()),
    ]);
    if (error) throw error;
    return ok({
      attendance: data ?? [],
      total: count ?? 0,
      todayCount: todayRes.count ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/attendance — assisted/manual check-in by front desk. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("attendance.write");
    const body = assistedCheckinSchema.parse(await req.json());
    const db = getServiceClient();

    const { data: settings } = await db
      .from("settings")
      .select("attendance_settings")
      .eq("gym_id", ctx.gymId)
      .maybeSingle();
    const duplicateWindow =
      (settings?.attendance_settings as { duplicate_checkin_minutes?: number } | null)
        ?.duplicate_checkin_minutes ?? 120;

    const result = await performCheckIn(
      ctx.gymId,
      body.member_id,
      body.source,
      ctx.profile.staff_id,
      null,
      duplicateWindow,
    );
    await audit(ctx, "ATTENDANCE_CREATED", "attendance", result.attendanceId, {
      source: body.source,
      member_id: body.member_id,
    });
    return ok(result, "Checked in", 201);
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
void auth; // keep Clerk import tree-shaken in build when unused elsewhere
