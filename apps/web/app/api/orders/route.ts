import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleError, ok, pageParams } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/server";

/** GET /api/orders — add-on orders with member + product. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth("addons.read");
    const url = new URL(req.url);
    const { from, to, page, pageSize } = pageParams(url);
    const { data, count, error } = await getServiceClient()
      .from("add_on_orders")
      .select("*, members(first_name, last_name, member_code), add_ons(name, type)", { count: "exact" })
      .eq("gym_id", ctx.gymId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ok({ orders: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}
