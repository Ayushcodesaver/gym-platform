"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Card, PageHeader, Skeleton, ErrorState, Input, Modal, useToast } from "@/components/ui";
import { QrCode, UserPlus } from "lucide-react";

interface AttendanceRow {
  id: string; checked_in_at: string; source: string;
  members?: { first_name: string; last_name: string; member_code: string };
}

export default function AttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ dataUrl: string; expiresAt: string } | null>(null);
  const [assisting, setAssisting] = useState(false);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) { setRows(j.data.attendance); setTodayCount(j.data.todayCount); }
        else setError(j.error?.message ?? "Failed to load attendance");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Rotate the displayed QR every 60s (server rotates the active session each call)
  const refreshQr = useCallback(async () => {
    try {
      const j = await fetch("/api/qr/session").then((r) => r.json());
      if (j.success) {
        const dataUrl = await QRCode.toDataURL(j.data.token, {
          width: 220, margin: 1,
          color: { dark: "#F5F5F5", light: "#0B0D10" },
        });
        setQr({ dataUrl, expiresAt: j.data.expiresAt });
      }
    } catch { /* console stays quiet; next rotation retries */ }
  }, []);
  useEffect(() => {
    refreshQr();
    const id = setInterval(refreshQr, 60_000);
    return () => clearInterval(id);
  }, [refreshQr]);

  return (
    <>
      <PageHeader
        title="Attendance"
        action={<Button onClick={() => setAssisting(true)}><UserPlus size={16} aria-hidden /> Assisted Check-in</Button>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-caption uppercase text-text-mid">Today&apos;s check-ins</p>
          <p className="mt-2 text-h1 font-bold tabular-nums">{todayCount}</p>
        </Card>

        {/* Scan QR — the main CTA of this screen (docs §19) */}
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              {qr ? (
                /* eslint-disable-next-line @next/next/no-img-element -- data-URL QR, not a remote image */
                <img src={qr.dataUrl} alt="Gym check-in QR code — members scan this" width={220} height={220}
                  className="rounded-card border border-line" />
              ) : (
                <div className="skeleton h-[220px] w-[220px]" />
              )}
              <p className="flex items-center gap-1.5 text-caption text-text-low">
                <QrCode size={12} aria-hidden /> rotates every 60s
              </p>
            </div>
            <div className="max-w-xs">
              <h2 className="text-h3">Scan QR</h2>
              <p className="mt-2 text-small text-text-mid">
                Members scan this code from the mobile app to check in. The code is
                session-bound and rotates automatically — old codes stop working immediately.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-0">
        {loading ? (
          <div className="p-5"><Skeleton rows={5} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption uppercase text-text-low">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3">
                      {r.members?.first_name} {r.members?.last_name}
                      <span className="ml-2 text-caption text-text-low">{r.members?.member_code}</span>
                    </td>
                    <td className="px-5 py-3 text-text-mid">
                      {new Date(r.checked_in_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-5 py-3 capitalize text-text-mid">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {assisting && (
        <AssistedModal onClose={() => setAssisting(false)}
          onDone={(msg) => { setAssisting(false); show(msg); load(); }} />
      )}
      {toast}
    </>
  );
}

function AssistedModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; first_name: string; last_name: string | null; member_code: string }>>([]);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live member search (same debounced endpoint as the directory)
  useEffect(() => {
    if (!query.trim() || selected) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/members?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((j) => { if (j.success) setResults(j.data.members.slice(0, 6)); })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, selected]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: selected.id, source: "assisted" }),
      });
      const j = await res.json();
      if (j.success) onDone(`${selected.label} checked in`);
      else setError(j.error?.message ?? "Check-in failed");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Assisted Check-in" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {selected ? (
          <div className="flex items-center justify-between rounded-btn border border-line bg-elevated px-4 py-3">
            <span className="text-small">{selected.label}</span>
            <Button variant="secondary" className="!min-h-[36px] !px-3 text-small"
              onClick={() => { setSelected(null); setQuery(""); }}>Change</Button>
          </div>
        ) : (
          <div className="relative">
            <Input label="Find member" placeholder="Name, code or phone" value={query}
              onChange={(e) => setQuery(e.target.value)} autoFocus />
            {(searching || results.length > 0) && (
              <div role="listbox" aria-label="Search results"
                className="absolute z-10 mt-1 w-full rounded-card border border-line bg-surface p-1 shadow-xl">
                {searching && <p className="px-3 py-2 text-small text-text-low">Searching…</p>}
                {results.map((m) => (
                  <button key={m.id} role="option" aria-selected={false}
                    onClick={() => setSelected({ id: m.id, label: `${m.first_name} ${m.last_name ?? ""} (${m.member_code})` })}
                    className="block w-full rounded px-3 py-2.5 text-left text-small hover:bg-elevated">
                    {m.first_name} {m.last_name ?? ""}
                    <span className="ml-2 text-caption text-text-low">{m.member_code}</span>
                  </button>
                ))}
                {!searching && results.length === 0 && query.length > 1 && (
                  <p className="px-3 py-2 text-small text-text-low">No members match “{query}”.</p>
                )}
              </div>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!selected || saving}>{saving ? "Checking in…" : "Check in"}</Button>
        </div>
      </div>
    </Modal>
  );
}
