"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Skeleton, ErrorState } from "@/components/ui";
import { AlertTriangle, RefreshCcw, Wallet, CalendarCheck, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  kpis: { totalMembers: number; activeMembers: number; checkinsToday: number; active7d: number; revenueMonth: number };
  expiringSoon: Array<{ id: string; expiry_date: string; members?: { first_name: string; last_name: string; member_code: string }; plans?: { name: string } }>;
  actionCenter: {
    noShowCases: Array<{ id: string; absent_days: number; members?: { first_name: string; last_name: string; member_code: string } }>;
    failedPayments: Array<{ id: string; amount: number; members?: { first_name: string; last_name: string } }>;
    pendingAddonOrders: unknown[];
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

  const kpis = [
    { label: "Active Members", value: data.kpis.activeMembers.toLocaleString("en-IN"), icon: Users },
    { label: "Today's Check-ins", value: data.kpis.checkinsToday.toLocaleString("en-IN"), icon: CalendarCheck },
    { label: "Active (7 days)", value: data.kpis.active7d.toLocaleString("en-IN"), icon: Users },
    { label: "Revenue (month)", value: inr(data.kpis.revenueMonth), icon: Wallet },
  ] as const;

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Row 1 — KPI cards (docs/desgin md §13): minimal, bold numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <p className="text-caption uppercase text-text-mid">{label}</p>
              <Icon size={18} className="text-text-low" aria-hidden />
            </div>
            <p className="mt-2 text-h1 font-bold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      {/* Row 3 — action center (peak-end + serial-position: action items visible near top) */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h3">Members requiring follow-up</h2>
            <Link href="/retention" className="flex items-center gap-1 text-small text-accent hover:text-accent-hover">
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
                  <span className="flex items-center gap-1.5 text-small text-warning">
                    <AlertTriangle size={14} aria-hidden /> {c.absent_days} days absent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h3">Expiring soon (14 days)</h2>
            <Link href="/renewals" className="flex items-center gap-1 text-small text-accent hover:text-accent-hover">
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
                  <span className="flex items-center gap-1.5 text-small text-text-mid">
                    <RefreshCcw size={14} aria-hidden className="text-warning" /> {m.expiry_date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
