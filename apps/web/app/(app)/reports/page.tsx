"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Skeleton, ErrorState } from "@/components/ui";

interface Reports {
  attendanceTrend: Array<{ date: string; count: number }>;
  revenueTrend: Array<{ date: string; amount: number }>;
  membershipMix: Record<string, number>;
  retention: { cases: number; resolved: number; resolvedRate: number; atRiskToday: number };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * One chart craft, two ranks: the main chart is bigger with the accent on the
 * latest bar, a secondary chart runs the same shape in neutral steps (docs §15).
 */
function BarChart({ data, valueFormat, main = false }: {
  data: Array<{ label: string; value: number }>;
  valueFormat: (n: number) => string;
  main?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const rows = data.slice(-30);
  const label = (d: { label: string }) =>
    new Date(d.label).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div>
      <div className={`relative flex ${main ? "h-56" : "h-40"} items-end gap-1`} role="img" aria-label="Bar chart of values by day">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line/60" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-line/40" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-line/40" />
        {rows.map((d, i) => {
          const isLatest = i === rows.length - 1;
          return (
            <div key={d.label} className="group relative flex-1">
              <div className={`w-full rounded-t-sm transition-colors ${
                main && isLatest ? "bg-accent group-hover:bg-accent-hover" : "bg-text-mid/30 group-hover:bg-text-mid/50"
              }`} style={{ height: `${Math.max(3, (d.value / max) * (main ? 210 : 150))}px` }} />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-elevated px-1.5 py-0.5 text-caption tabular-nums text-text-hi group-hover:block">
                {valueFormat(d.value)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-caption tabular-nums text-text-low">
        <span>{label(rows[0] ?? { label: "" })}</span>
        <span>{label(rows[Math.floor((rows.length - 1) / 2)] ?? { label: "" })}</span>
        <span>{label(rows[rows.length - 1] ?? { label: "" })}</span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<Reports | null>(null);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports?range=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setError(j.error?.message ?? "Failed to load reports");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <>
      <PageHeader
        title="Reports"
        action={
          <select aria-label="Date range" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />
      {loading ? (
        <Skeleton rows={6} />
      ) : error || !data ? (
        <ErrorState message={error ?? "Failed to load"} onRetry={() => setRange(range)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* The main chart — clearly the biggest thing on the screen */}
          <Card className="lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-h3">Attendance</h2>
              <p className="text-caption text-text-low">Check-ins per day</p>
            </div>
            <BarChart main data={data.attendanceTrend.map((d) => ({ label: d.date, value: d.count }))} valueFormat={(n) => `${n}`} />
          </Card>
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-h3">Revenue</h2>
              <p className="text-caption text-text-low">Verified payments per day</p>
            </div>
            <BarChart data={data.revenueTrend.map((d) => ({ label: d.date, value: d.amount }))} valueFormat={inr} />
          </Card>
          <Card>
            <h2 className="text-h3">Membership mix</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {Object.entries(data.membershipMix).map(([status, n], i, all) => {
                const max = Math.max(1, ...all.map(([, v]) => v));
                return (
                  <li key={status} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-small">
                      <span className="capitalize text-text-mid">{status}</span>
                      <span className="tabular-nums text-text-hi">{n}</span>
                    </div>
                    <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-elevated">
                      <div className={`h-full rounded-full ${i === 0 ? "bg-accent" : "bg-text-mid/40"}`}
                        style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-h3">Retention</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-small sm:grid-cols-4">
              <li className="flex flex-col gap-0.5"><span className="text-caption text-text-low">No-show cases</span><span className="text-h3 tabular-nums">{data.retention.cases}</span></li>
              <li className="flex flex-col gap-0.5"><span className="text-caption text-text-low">Resolved</span><span className="text-h3 tabular-nums">{data.retention.resolved}</span></li>
              <li className="flex flex-col gap-0.5"><span className="text-caption text-text-low">Resolution rate</span><span className="text-h3 tabular-nums">{data.retention.resolvedRate}%</span></li>
              <li className="flex flex-col gap-0.5"><span className="text-caption text-text-low">At risk today</span><span className="text-h3 tabular-nums">{data.retention.atRiskToday}</span></li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
