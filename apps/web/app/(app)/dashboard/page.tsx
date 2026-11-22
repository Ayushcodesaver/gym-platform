"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Skeleton, ErrorState } from "@/components/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  kpis: {
    totalMembers: number; activeMembers: number; checkinsToday: number; checkinsYesterday: number;
    active7d: number; revenueMonth: number; revenuePrevMonth: number;
  };
  checkinTrend: Array<{ date: string; count: number }>;
  expiringSoon: Array<{ id: string; expiry_date: string; members?: { first_name: string; last_name: string; member_code: string }; plans?: { name: string } }>;
  actionCenter: {
    noShowCases: Array<{ id: string; absent_days: number; members?: { first_name: string; last_name: string; member_code: string } }>;
    failedPayments: Array<{ id: string; amount: number; members?: { first_name: string; last_name: string } }>;
    pendingAddonOrders: unknown[];
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });

/** The floor, last 14 days — the main moment of this screen. Today carries the accent. */
function TrendChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const today = data[data.length - 1];
  return (
    <div className="flex h-44 items-end gap-1.5" role="img"
      aria-label={`Bar chart of check-ins per day for the last 14 days, ${today.count} today`}>
      {data.map((d) => {
        const isToday = d.date === today.date;
        return (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end gap-1.5">
            <span className={`pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-elevated px-1.5 py-0.5 text-caption tabular-nums text-text-hi group-hover:block`}>
              {d.count} · {day(d.date)}
            </span>
            <div className={`w-full rounded-t-sm transition-colors ${isToday ? "bg-accent group-hover:bg-accent-hover" : "bg-text-mid/30 group-hover:bg-text-mid/50"}`}
              style={{ height: `${Math.max(4, (d.count / max) * 150)}px` }} />
            <span className={`text-center text-caption tabular-nums ${isToday ? "font-medium text-accent" : "text-text-low"}`}>
              {Number(d.date.slice(8))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Live indicator — the signature dot. Used only where the figure is actually live. */
function LiveDot() {
  return (
    <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/dashboard")
      .then(async (r) => (await r.json()) as { success: boolean; data?: DashboardData; error?: { message: string } })
      .then((j) => {
        if (j.success && j.data) setData(j.data);
        else setError(j.error?.message ?? "Failed to load dashboard");
      })
      .catch(() => setError("Network error — check your connection and retry."))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // Selective live updates (master prompt §65): lightweight KPI polling keeps the
    // action center fresh without making the app realtime-dependent. Supabase
    // Realtime is the production upgrade path once Clerk JWTs are synced to
    // Supabase auth (see README → Realtime).
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <><PageHeader title="Dashboard" /><Skeleton rows={6} /></>;
  if (error || !data) return <ErrorState message={error ?? "Failed to load"} onRetry={load} />;

  const { kpis, checkinTrend } = data;
  const revenueDelta = kpis.revenuePrevMonth > 0
    ? Math.round(((kpis.revenueMonth - kpis.revenuePrevMonth) / kpis.revenuePrevMonth) * 100)
    : null;
  const deltaLabel = revenueDelta === null
    ? "No revenue last month"
    : `${revenueDelta >= 0 ? "+" : "−"}${Math.abs(revenueDelta)}% vs last month`;

  const stats = [
    { label: "Active members", value: kpis.activeMembers.toLocaleString("en-IN"), meta: `${kpis.totalMembers.toLocaleString("en-IN")} total` },
    { label: "Revenue this month", value: inr(kpis.revenueMonth), meta: deltaLabel },
    { label: "Active (7 days)", value: kpis.active7d.toLocaleString("en-IN"), meta: "checked in this week" },
  ] as const;

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Row 1 — compact stats (docs/desgin md §13): the number, its label, its context */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, meta }) => (
          <Card key={label} className="flex flex-col gap-2">
            <p className="text-small text-text-mid">{label}</p>
            <p className="text-h1 font-medium tabular-nums leading-none">{value}</p>
            <p className="text-caption text-text-low">{meta}</p>
          </Card>
        ))}
      </div>

      {/* Row 2 — the main moment: the floor, live */}
      <Card className="mt-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-h3">Check-ins</h2>
          <p className="flex items-center gap-2 text-small text-text-mid">
            <LiveDot />
            <span className="text-h3 font-medium tabular-nums text-text-hi">{kpis.checkinsToday}</span>
            today
            <span className="text-text-low">· {kpis.checkinsYesterday} yesterday</span>
          </p>
        </div>
        <TrendChart data={checkinTrend} />
      </Card>

      {/* Row 3 — action center (peak-end + serial-position: action items visible near top) */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h3">Members requiring follow-up</h2>
            <Link href="/retention" className="flex items-center gap-1 text-small text-text-mid hover:text-text-hi">
              View all <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          {data.actionCenter.noShowCases.length === 0 ? (
            <p className="text-small text-text-mid">No members are overdue right now. Everyone is on track.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.actionCenter.noShowCases.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <span className="text-small">
                    {c.members?.first_name} {c.members?.last_name}
                    <span className="ml-2 text-caption text-text-low">{c.members?.member_code}</span>
                  </span>
                  <span className="text-small tabular-nums text-warning">
                    {c.absent_days} days absent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h3">Expiring soon (14 days)</h2>
            <Link href="/renewals" className="flex items-center gap-1 text-small text-text-mid hover:text-text-hi">
              Renewals <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          {data.expiringSoon.length === 0 ? (
            <p className="text-small text-text-mid">No memberships expire in the next 14 days.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.expiringSoon.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span className="text-small">
                    {m.members?.first_name} {m.members?.last_name}
                    <span className="ml-2 text-caption text-text-low">{m.plans?.name}</span>
                  </span>
                  <span className="text-small tabular-nums text-text-mid">{day(m.expiry_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
