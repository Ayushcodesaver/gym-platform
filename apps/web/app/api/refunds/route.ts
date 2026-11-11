import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { audit, fail, handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";
import { createRefundSchema } from "@gym/validation";

/** GET /api/refunds — refund records for this gym. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("payments.read");
    const url = new URL(req.url);
    const { from, to, page, pageSize } = pageParams(url);
    const { data, count, error } = await getServiceClient()
      .from("refunds")
      .select("*, payments(amount, status, members(first_name, last_name, member_code))", { count: "exact" })
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ok({ refunds: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/refunds — record + process a refund (master prompt §33).
 * The original payment is never deleted: it transitions to `refunded` and a
 * separate refunds row keeps the audit trail.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth("payments.write");
    const body = createRefundSchema.parse(await req.json());
    const db = getServiceClient();

    const { data: payment } = await db
      .from("payments")
      .select("id, amount, status, provider_reference, member_id")
      .eq("gym_id", ctx.gymId)
      .eq("id", body.payment_id)
      .single();
    if (!payment) return fail(404, "NOT_FOUND", "Payment not found");
    if (payment.status !== "paid") {
      return fail(409, "PAYMENT_ERROR", `Only paid payments can be refunded (current: ${payment.status})`);
    }

    const amount = body.amount ?? Number(payment.amount);
    if (amount > Number(payment.amount)) {
      return fail(422, "PAYMENT_ERROR", "Refund amount cannot exceed the payment amount");
    }

    // Idempotency: one in-flight/processed refund per payment
    const { count: existing } = await db
      .from("refunds")
      .select("id", { count: "exact", head: true })
      .eq("payment_id", payment.id)
      .in("status", ["pending", "processed"]);
    if ((existing ?? 0) > 0) return fail(409, "CONFLICT", "A refund already exists for this payment");

    const { data: refund, error } = await db
      .from("refunds")
      .insert({
        gym_id: ctx.gymId,
        payment_id: payment.id,
        amount,
        provider_reference: `refund_${payment.provider_reference ?? payment.id}`,
        reason: body.reason ?? null,
        status: "processed",
      })
      .select("*")
      .single();
    if (error) throw error;

    await db
      .from("payments")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    await db.from("renewal_orders").update({ status: "refunded" }).eq("payment_id", payment.id);

    await audit(ctx, "PAYMENT_REFUNDED", "refund", refund.id, {
      payment_id: payment.id,
      amount,
      reason: body.reason ?? null,
    });
    return ok(refund, "Refund recorded", 201);
  } catch (e) {
    return handleError(e);
  }
}
