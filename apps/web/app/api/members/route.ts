import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, fail, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createMemberSchema, listQuerySchema } from "@gym/validation";

/** GET /api/members?q=&status=&page= — member directory (server-side paging). */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("members.read");
    const url = new URL(req.url);
    const { q, status } = listQuerySchema.parse(Object.fromEntries(url.searchParams));
    const { from, to, page, pageSize } = pageParams(url);

    const db = getServiceClient();
    let query = db
      .from("members")
      .select(
        `*, memberships(plan_id, status, expiry_date, plans(name)),
         attendance(checked_in_at)`,
        { count: "exact" },
      )
      .eq("gym_id", ctx.gymId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,member_code.ilike.%${q}%,phone.ilike.%${q}%`);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((m: Record<string, unknown>) => {
      const ms = (m.memberships as Array<{ status: string; expiry_date: string; plans?: { name?: string } }> | null) ?? [];
      const active = ms.find((x) => x.status === "active") ?? ms[0] ?? null;
      const atts = (m.attendance as Array<{ checked_in_at: string }> | null) ?? [];
      const last = atts.map((a) => a.checked_in_at).sort().at(-1) ?? null;
      const { memberships, attendance, ...rest } = m;
      return {
        ...rest,
        membership_status: active?.status ?? null,
        plan_name: active?.plans?.name ?? null,
        expiry_date: active?.expiry_date ?? null,
        last_check_in_at: last,
      };
    });
    return ok({ members: rows, total: count ?? 0, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/members — front desk / manager creates a member. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("members.write");
    const body = createMemberSchema.parse(await req.json());
    const db = getServiceClient();

    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", ctx.gymId);
    const memberCode = `GYM${1000 + (count ?? 0) + 1}`;

    const { data, error } = await db
      .from("members")
      .insert({ ...body, gym_id: ctx.gymId, member_code: memberCode })
      .select("*")
      .single();
    if (error) throw error;
    await audit(ctx, "MEMBER_CREATED", "member", data.id, { member_code: memberCode });
    return ok(data, "Member added", 201);
  } catch (e) {
    return handleError(e);
  }
}

export function PUT() { return fail(405, "VALIDATION_ERROR", "Method not allowed"); }
