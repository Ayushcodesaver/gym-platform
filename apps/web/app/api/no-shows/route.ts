import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createFollowUpSchema, noShowActionSchema } from "@gym/validation";

/** GET /api/no-shows?status= — red list (no-show cases) with member info. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("followups.read");
    const status = new URL(req.url).searchParams.get("status") ?? "open";
    const db = getServiceClient();
    const { data, error } = await db
      .from("no_show_cases")
      .select("*, members(first_name, last_name, member_code, phone)")
      .eq("gym_id", ctx.gymId)
      .eq("status", status)
      .order("absent_days", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/no-shows — { scan: true } triggers the daily scan; { action } mutates a case. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("followups.write");
    const body = await req.json();

    if (body?.scan === true) {
      const db = getServiceClient();
      const { data: gym } = await db
        .from("gyms")
        .select("no_show_threshold_days")
        .eq("id", ctx.gymId)
        .single();
      const result = await import("@/lib/attendance").then((m) =>
        m.runNoShowScan(ctx.gymId, gym?.no_show_threshold_days ?? 10),
      );
      return ok(result, `Scan complete: ${result.created} new case(s)`);
    }

    const parsed = noShowActionSchema.parse(body);
    const caseId = parsed.assigned_staff_id ? undefined : (body as { case_id?: string }).case_id;
    if (!caseId) return ok(null, "case_id required", 422);

    const db = getServiceClient();
    const patch: Record<string, unknown> =
      parsed.action === "assign"
        ? { assigned_staff_id: parsed.assigned_staff_id, status: "in_progress" }
        : parsed.action === "start"
          ? { status: "in_progress" }
          : parsed.action === "resolve"
            ? { status: "resolved", resolved_at: new Date().toISOString() }
            : { status: "cancelled", resolved_at: new Date().toISOString() };

    const { data, error } = await db
      .from("no_show_cases")
      .update(patch)
      .eq("gym_id", ctx.gymId)
      .eq("id", caseId)
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "NO_SHOW_UPDATED", "no_show_case", caseId, patch);
    return ok(data, "Case updated");
  } catch (e) {
    return handleError(e);
  }
}

/** PUT /api/no-shows is not used; follow-ups POST lives in its own route. */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuth("followups.write");
    const body = createFollowUpSchema.parse(await req.json());
    const db = getServiceClient();
    const { data, error } = await db
      .from("follow_ups")
      .insert({ ...body, gym_id: ctx.gymId, staff_id: ctx.profile.staff_id })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "FOLLOW_UP_CREATED", "follow_up", data.id, { member_id: body.member_id });
    return ok(data, "Follow-up recorded", 201);
  } catch (e) {
    return handleError(e);
  }
}
