"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, PageHeader, Skeleton, StatusBadge, ErrorState, Button, useToast } from "@/components/ui";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";

interface PipelineRow {
  id: string; member_id: string; expiry_date: string; status: string; stage: string;
  members?: { first_name: string; last_name: string; member_code: string; phone: string | null };
  plans?: { name: string; price: number };
}

const STAGES = ["upcoming", "contacted", "interested", "payment_pending", "renewed", "expired"] as const;

/** DB-backed renewal pipeline (master prompt §30) — stages derive from real rows. */
export default function RenewalsPage() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [byStage, setByStage] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/renewals")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) { setRows(j.data.pipeline); setByStage(j.data.byStage); }
        else setError(j.error?.message ?? "Failed to load pipeline");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createIntent = async (row: PipelineRow) => {
    // Renewal path: create the payment intent for this member+plan
    const j = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: row.member_id, plan_id: row.id, type: "renewal" }),
    }).then((r) => r.json());
    show(j.message ?? "Intent created", j.success ? "ok" : "err");
    if (j.success) load();
  };

  const visible = filter === "all" ? rows : rows.filter((r) => r.stage === filter);
  const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <>
      <PageHeader title="Renewal Pipeline" />

      {/* Stage counters — real counts from the database */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`min-h-[36px] rounded-btn border px-3 text-small transition-colors ${filter === "all" ? "border-accent text-accent" : "border-line text-text-mid hover:text-text-hi"}`}>
          All ({rows.length})
        </button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`min-h-[36px] rounded-btn border px-3 capitalize text-small transition-colors ${filter === s ? "border-accent text-accent" : "border-line text-text-mid hover:text-text-hi"}`}>
            {s.replace("_", " ")} ({byStage[s] ?? 0})
          </button>
        ))}
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-5"><Skeleton rows={5} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-small text-text-mid">
            No memberships in this stage. Reminders are sent 14 / 7 / 3 days before expiry and on expiry day.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption uppercase text-text-low">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/50">
                    <td className="px-5 py-3">
                      <Link href={`/members/${m.member_id}`} className="hover:text-accent">
                        {m.members?.first_name} {m.members?.last_name}
                      </Link>
                      <span className="ml-2 text-caption text-text-low">{m.members?.member_code}</span>
                    </td>
                    <td className="px-5 py-3 text-text-mid">{m.plans?.name} {m.plans ? `· ${inr(m.plans.price)}` : ""}</td>
                    <td className="px-5 py-3 text-text-mid">{m.expiry_date}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-small text-warning">
                        <RefreshCcw size={13} aria-hidden /> {m.stage.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3 text-right">
                      {m.stage !== "renewed" && (
                        <Button variant="secondary" className="!min-h-[36px] !px-3 text-small" onClick={() => createIntent(m)}>
                          Create renewal
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {toast}
    </>
  );
}
