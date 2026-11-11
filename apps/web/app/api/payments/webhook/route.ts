import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { fulfillPayment, verifyWebhookSignature } from "@/lib/payments";
import { paymentWebhookSchema } from "@gym/validation";

/**
 * POST /api/payments/webhook — provider callback (TRD §46).
 * 1. HMAC-SHA256 signature verification against PAYMENT_WEBHOOK_SECRET (constant-time).
 * 2. Fulfillment is idempotent: UNIQUE(provider_reference) + conditional status latch
 *    mean duplicate deliveries never double-extend a membership.
 * No auth envelope here by design — the signature IS the authentication.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return fail(401, "AUTHENTICATION_ERROR", "Invalid signature");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(400, "VALIDATION_ERROR", "Malformed body");
  }
  const event = paymentWebhookSchema.safeParse(parsed);
  if (!event.success) return fail(422, "VALIDATION_ERROR", "Unexpected payload shape");

  const entity = event.data.payload.payment.entity;
  try {
    const result = await fulfillPayment({
      providerReference: entity.id,
      amount: entity.amount / 100, // provider amounts arrive in paise
      providerStatus: entity.status,
    });
    return ok(result);
  } catch {
    return fail(500, "PAYMENT_ERROR", "Fulfillment failed");
  }
}
