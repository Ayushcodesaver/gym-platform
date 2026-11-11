import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { ERROR_CODES } from "@gym/constants";
import { HttpError } from "@/lib/auth";

/**
 * Payment pipeline (PRD §24, TRD §46): checkout ≠ paid. Verification happens
 * ONLY here (server-side webhook with HMAC verification + idempotent fulfillment).
 * The frontend success screen is never treated as verification.
 */

export interface PaymentIntent {
  paymentId: string;
  providerOrderId: string;
  amount: number;
  currency: "INR";
}

export async function createPaymentIntent(
  gymId: string,
  memberId: string,
  amount: number,
  kind: "renewal" | "add_on",
  refId: string, // membership_id or add_on_id
  provider = "razorpay",
): Promise<PaymentIntent> {
  const db = getServiceClient();
  const providerOrderId = `order_${randomBytes(9).toString("hex")}`;
  const { data: payment, error } = await db
    .from("payments")
    .insert({
      gym_id: gymId,
      member_id: memberId,
      membership_id: kind === "renewal" ? refId : null,
      provider,
      provider_reference: providerOrderId,
      amount,
      currency: "INR",
      status: "created",
    })
    .select("id, provider_reference, amount, currency")
    .single();
  if (error || !payment) throw error ?? new Error("payment insert failed");

  if (kind === "renewal") {
    await db.from("renewal_orders").insert({
      gym_id: gymId,
      member_id: memberId,
      membership_id: refId,
      plan_id: (await db.from("memberships").select("plan_id").eq("id", refId).single()).data?.plan_id,
      payment_id: payment.id,
      amount,
      status: "pending",
    });
  } else {
    // add-on order is created at intent time, fulfilled on verification
    await db.from("add_on_orders").insert({
      gym_id: gymId,
      member_id: memberId,
      add_on_id: refId,
      payment_id: payment.id,
      quantity: 1,
      status: "pending",
      sessions_remaining: (
        await db.from("add_ons").select("session_count").eq("id", refId).single()
      ).data?.session_count ?? null,
    });
  }
  return {
    paymentId: payment.id,
    providerOrderId: payment.provider_reference,
    amount: Number(payment.amount),
    currency: payment.currency as "INR",
  };
}

/** Constant-time HMAC-SHA256 webhook signature verification. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface WebhookPayment {
  providerReference: string;
  amount: number;
  providerStatus: string;
}

/**
 * Idempotent fulfillment (TRD §47): the UNIQUE(provider_reference) constraint plus
 * the conditional UPDATE make double-delivery a no-op — membership is extended
 * exactly once. Runs in-transaction at the DB level for the critical state change.
 */
export async function fulfillPayment(webhook: WebhookPayment): Promise<{ duplicate: boolean }> {
  const db = getServiceClient();
  const { providerReference, amount, providerStatus } = webhook;

  const { data: payment } = await db
    .from("payments")
    .select("id, gym_id, member_id, membership_id, amount, status")
    .eq("provider_reference", providerReference)
    .maybeSingle();
  if (!payment) throw new HttpError(404, ERROR_CODES.PAYMENT_ERROR, "Unknown payment reference");

  if (payment.status === "paid") return { duplicate: true }; // already fulfilled
  if (providerStatus !== "captured" && providerStatus !== "success") {
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return { duplicate: false };
  }
  if (Number(payment.amount) !== amount) {
    // Amount mismatch = reject (TRD: validate amount)
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    throw new HttpError(400, ERROR_CODES.PAYMENT_ERROR, "Amount mismatch");
  }

  const now = new Date().toISOString();

  // Conditional update = idempotency latch: only the first caller flips status
  const { data: latched, error: latchErr } = await db
    .from("payments")
    .update({ status: "paid", updated_at: now })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id")
    .single();
  if (latchErr || !latched) return { duplicate: true };

  await db.from("renewal_orders").update({ status: "paid" }).eq("payment_id", payment.id);
  await db.from("add_on_orders").update({ status: "paid" }).eq("payment_id", payment.id);

  // Extend membership exactly once: push expiry by the plan duration from max(today, expiry)
  if (payment.membership_id) {
    const { data: membership } = await db
      .from("memberships")
      .select("id, plan_id, expiry_date, status, gym_id, member_id")
      .eq("id", payment.membership_id)
      .single();
    if (membership) {
      const { data: plan } = await db
        .from("plans")
        .select("duration_days")
        .eq("id", membership.plan_id)
        .single();
      const base = new Date(
        Math.max(
          new Date(membership.expiry_date + "T00:00:00Z").getTime(),
          new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime(),
        ),
      );
      base.setUTCDate(base.getUTCDate() + (plan?.duration_days ?? 30));
      const newExpiry = base.toISOString().slice(0, 10);
      await db
        .from("memberships")
        .update({ expiry_date: newExpiry, status: "active", updated_at: now })
        .eq("id", membership.id)
        .neq("expiry_date", newExpiry); // no-op guard

      await db.from("notifications").insert({
        gym_id: membership.gym_id,
        member_id: membership.member_id,
        type: "PAYMENT_CONFIRMED",
        title: "Payment confirmed",
        body: `Membership renewed until ${newExpiry}.`,
        channel: "push",
        status: "queued",
      });
    }
  }
  return { duplicate: false };
}
