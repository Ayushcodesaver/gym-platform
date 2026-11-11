import { requireAuth } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { createQrSession, QR_ROTATION_SECONDS } from "@/lib/qr";

/**
 * GET /api/qr/session — returns the gym's current QR token.
 * The console calls this on load and every QR_ROTATION_SECONDS; each call
 * rotates the active session (previous tokens stop verifying immediately).
 */
export async function GET() {
  try {
    const ctx = await requireAuth("attendance.write");
    const { token, expiresAt } = await createQrSession(ctx.gymId);
    return ok({ token, expiresAt, rotationSeconds: QR_ROTATION_SECONDS });
  } catch (e) {
    return handleError(e);
  }
}
