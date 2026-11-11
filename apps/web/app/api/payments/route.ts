import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/auth";
import { audit, fail, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createPaymentIntentSchema, confirmAssistedPaymentSchema } from "@gym/validation";
import { createPaymentIntent, fulfillPayment } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/payments?member_id= — payment history. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("payments.read");
    const url = new URL(req.url);
    const { from, to, page, pageSize } = pageParams(url);
    const memberId = url.searchParams.get("member_id");
    const db = getServiceClient();
    let query = db
      .from("payments")
      .select("*, members(first_name, last_name, member_code)", { count: "exact" })
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (memberId) query = query.eq("member_id", memberId);
    const { data, count, error } = await query;
    if (error) throw error;
    return ok({ payments: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/payments — two modes: create an online intent, or confirm cash at desk. */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "payments", { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return fail(429, "RATE_LIMIT_ERROR", "Too many attempts. Try again shortly.");
  try {
    const body = await req.json();

    // Assisted (cash) confirmation: front desk records a paid amount directly.
    if (body?.payment_id) {
      const ctx = await requireAuth("payments.confirm");
      const parsed = confirmAssistedPaymentSchema.parse(body);
      const db = getServiceClient();
      const { data: p } = await db
        .from("payments")
        .select("id, amount, status, provider_reference")
        .eq("gym_id", ctx.gymId)
        .eq("id", parsed.payment_id)
        .single();
      if (!p) return fail(404, "NOT_FOUND", "Payment not found");
      if (p.status === "paid") return ok({ duplicate: true }, "Already confirmed");
      if (Number(p.amount) !== parsed.amount_paid) {
        return fail(400, "PAYMENT_ERROR", "Amount mismatch");
      }
      const result = await fulfillPayment({
        providerReference: p.provider_reference ?? p.id,
        amount: Number(p.amount),
        providerStatus: "success",
      });
      await audit(ctx, "PAYMENT_CONFIRMED", "payment", p.id, { source: "assisted" });
      return ok(result, "Payment confirmed");
    }

    // Online intent creation
    const ctx = await requireAuth("payments.write");
    const parsed = createPaymentIntentSchema.parse(body);
    const db = getServiceClient();

    let amount = 0;
    let refId: string;
    if (parsed.type === "renewal") {
      const membershipId = await resolveMembershipId(db, ctx.gymId, parsed.member_id, parsed.plan_id);
      const { data: membership } = await db
        .from("memberships")
        .select("id, plans(price, discount)")
        .eq("gym_id", ctx.gymId)
        .eq("id", membershipId)
        .single();
      if (!membership) return fail(404, "NOT_FOUND", "Membership not found");
      const plan = Array.isArray(membership.plans) ? membership.plans[0] : membership.plans;
      amount = Number(plan?.price ?? 0) - Number(plan?.discount ?? 0);
      refId = membership.id;
    } else {
      const { data: addOn } = await db
        .from("add_ons")
        .select("id, price")
        .eq("gym_id", ctx.gymId)
        .eq("id", parsed.add_on_id!)
        .single();
      if (!addOn) return fail(404, "NOT_FOUND", "Add-on not found");
      amount = Number(addOn.price) * parsed.quantity;
      refId = addOn.id;
    }

    const intent = await createPaymentIntent(
      ctx.gymId,
      parsed.member_id,
      amount,
      parsed.type,
      refId,
    );
    await audit(ctx, "PAYMENT_CREATED", "payment", intent.paymentId, { type: parsed.type, amount });
    return ok(intent, "Payment intent created", 201);
  } catch (e) {
    return handleError(e);
  }
}

async function resolveMembershipId(
  db: ReturnType<typeof getServiceClient>,
  gymId: string,
  memberId: string,
  planId: string,
): Promise<string> {
  const { data: existing } = await db
    .from("memberships")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await db
    .from("memberships")
    .insert({ gym_id: gymId, member_id: memberId, plan_id: planId, start_date: new Date().toISOString().slice(0, 10), expiry_date: new Date().toISOString().slice(0, 10), status: "pending" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}
void auth;
