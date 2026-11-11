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

/** Simple inline SVG charts (neutral grid, orange data color — docs §15). */
function BarChart({ data, valueFormat }: { data: Array<{ label: string; value: number }>; valueFormat: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Bar chart of values by day">
      {data.slice(-30).map((d) => (
        <div key={d.label} className="group relative flex-1">
          <div className="w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
            style={{ height: `${Math.max(4, (d.value / max) * 150)}px` }} />
          <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-elevated px-1.5 py-0.5 text-caption text-text-hi group-hover:block">
            {valueFormat(d.value)}
          </span>
        </div>
      ))}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-h3">Attendance</h2>
            <p className="mb-3 text-caption text-text-low">Check-ins per day</p>
            <BarChart data={data.attendanceTrend.map((d) => ({ label: d.date, value: d.count }))} valueFormat={(n) => `${n}`} />
          </Card>
          <Card>
            <h2 className="text-h3">Revenue</h2>
            <p className="mb-3 text-caption text-text-low">Verified payments per day</p>
            <BarChart data={data.revenueTrend.map((d) => ({ label: d.date, value: d.amount }))} valueFormat={inr} />
          </Card>
          <Card>
            <h2 className="text-h3">Membership mix</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {Object.entries(data.membershipMix).map(([status, n]) => (
                <li key={status} className="flex justify-between text-small">
                  <span className="capitalize text-text-mid">{status}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-h3">Retention</h2>
            <ul className="mt-3 flex flex-col gap-2 text-small">
              <li className="flex justify-between"><span className="text-text-mid">No-show cases (period)</span><span className="tabular-nums">{data.retention.cases}</span></li>
              <li className="flex justify-between"><span className="text-text-mid">Resolved</span><span className="tabular-nums">{data.retention.resolved}</span></li>
              <li className="flex justify-between"><span className="text-text-mid">Resolution rate</span><span className="tabular-nums">{data.retention.resolvedRate}%</span></li>
              <li className="flex justify-between"><span className="text-text-mid">At risk today</span><span className="tabular-nums">{data.retention.atRiskToday}</span></li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
