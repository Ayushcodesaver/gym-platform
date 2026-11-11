import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Rotating QR sessions (TRD §41): the gym console shows a QR that rotates every
 * rotationSeconds. Only the SHA-256 hash of the token is stored — the raw token
 * is never persisted (docs/database.md §18). Verification is constant-time.
 */
export const QR_ROTATION_SECONDS = 60;
const QR_VALIDITY_SECONDS = 90; // slight grace so an in-flight scan never races rotation

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export async function createQrSession(gymId: string): Promise<{ token: string; expiresAt: string }> {
  const db = getServiceClient();
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + QR_VALIDITY_SECONDS * 1000).toISOString();

  // Expire/rotate: mark any live sessions of this gym as expired, then insert the new one
  await db
    .from("qr_sessions")
    .update({ status: "expired" })
    .eq("gym_id", gymId)
    .eq("status", "active");
  const { error } = await db.from("qr_sessions").insert({
    gym_id: gymId,
    token_hash: hashToken(raw),
    expires_at: expiresAt,
    status: "active",
  });
  if (error) throw error;
  return { token: raw, expiresAt };
}

export interface QrLookupResult {
  ok: boolean;
  sessionId: string | null;
  gymId: string | null;
}

export async function findActiveQrSession(rawToken: string): Promise<QrLookupResult> {
  const db = getServiceClient();
  const tokenHash = hashToken(rawToken);
  const { data } = await db
    .from("qr_sessions")
    .select("id, gym_id, token_hash, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || safeEqualHex(data.token_hash, tokenHash) === false) return { ok: false, sessionId: null, gymId: null };
  if (data.status !== "active" || new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, sessionId: null, gymId: null };
  }
  return { ok: true, sessionId: data.id, gymId: data.gym_id };
}
