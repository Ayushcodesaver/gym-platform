import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth";

/** Standard success envelope (TRD §15). */
export function ok<T>(data: T, message?: string, status = 200) {
  return NextResponse.json({ success: true, data, message }, { status });
}

/** Standard error envelope. Never leaks stack traces or internals. */
export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Maps thrown errors to the standard envelope without exposing internals. */
export function handleError(e: unknown) {
  if (e instanceof HttpError) return fail(e.status, e.code, e.message);
  if (e instanceof ZodError) {
    const first = e.errors[0];
    return fail(422, "VALIDATION_ERROR", first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input");
  }
  console.error("[api]", e instanceof Error ? e.message : e); // server log only
  return fail(500, "DATABASE_ERROR", "Something went wrong. Please try again.");
}

/** Append-only audit trail for sensitive actions (TRD §63). */
export async function audit(
  ctx: AuthContext,
  action: string,
  entityType: string | null,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await getServiceClient().from("audit_logs").insert({
      gym_id: ctx.gymId,
      user_profile_id: ctx.profile.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("[audit] failed", e instanceof Error ? e.message : e);
  }
}

/** Pagination slice for list endpoints (server-side paging, docs §65). */
export function pageParams(url: URL, fallbackSize = 20) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? fallbackSize) || fallbackSize));
  return { page, pageSize, from: (page - 1) * pageSize, to: (page - 1) * pageSize + pageSize - 1 };
}
