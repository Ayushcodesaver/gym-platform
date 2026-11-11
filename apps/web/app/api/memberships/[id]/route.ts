import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { membershipActionSchema } from "@gym/validation";
import { canTransition } from "@gym/constants/membership-transitions";

type Params = { params: { id: string } };

const ACTION_TARGET: Record<string, "active" | "frozen" | "cancelled"> = {
  activate: "active",
  freeze: "frozen",
  unfreeze: "active",
  cancel: "cancelled",
};

/** PATCH /api/memberships/:id — activate | freeze | unfreeze | extend | cancel. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAuth("memberships.write");
    const body = membershipActionSchema.parse(await req.json());
    const db = getServiceClient();

    const { data: m } = await db
      .from("memberships")
      .select("*")
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .single();
    if (!m) return ok(null, "Membership not found", 404);

    // State machine: reject invalid transitions (master prompt §18)
    const target = ACTION_TARGET[body.action];
    if (target && !canTransition(m.status, target)) {
      return fail(409, "CONFLICT", `Cannot ${body.action.replace("_", " ")} a ${m.status} membership`);
    }

    const today = new Date().toISOString().slice(0, 10);
    let patch: Record<string, unknown> = {};

    switch (body.action) {
      case "activate":
        patch = { status: "active" };
        break;
      case "freeze":
        patch = { status: "frozen", pause_start: today };
        break;
      case "unfreeze": {
        // Extend by the frozen duration so freeze time is not lost
        const days = m.pause_start
          ? Math.max(0, Math.round((Date.now() - new Date(m.pause_start).getTime()) / 86_400_000))
          : 0;
        const exp = new Date(m.expiry_date + "T00:00:00Z");
        exp.setUTCDate(exp.getUTCDate() + days);
        patch = { status: "active", pause_start: null, pause_end: today, expiry_date: exp.toISOString().slice(0, 10) };
        break;
      }
      case "extend": {
        if (!body.extend_days) return ok(null, "extend_days required", 422);
        const exp = new Date(
          Math.max(new Date(m.expiry_date + "T00:00:00Z").getTime(), new Date(today + "T00:00:00Z").getTime()),
        );
        exp.setUTCDate(exp.getUTCDate() + body.extend_days);
        patch = { expiry_date: exp.toISOString().slice(0, 10), status: m.status === "pending" ? "pending" : m.status };
        break;
      }
      case "cancel":
        patch = { status: "cancelled" };
        break;
    }

    const { data, error } = await db
      .from("memberships")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("gym_id", ctx.gymId)
      .eq("id", params.id)
      .select("*, plans(name)")
      .single();
    if (error) throw error;
    await audit(ctx, `MEMBERSHIP_${body.action.toUpperCase()}`, "membership", params.id, patch);
    return ok(data, `Membership ${body.action} done`);
  } catch (e) {
    return handleError(e);
  }
}
