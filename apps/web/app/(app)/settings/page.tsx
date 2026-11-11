"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader, Skeleton, ErrorState, useToast } from "@/components/ui";

interface Gym { name: string; phone: string | null; email: string | null; address: string | null; no_show_threshold_days: number }
interface Settings {
  attendance_settings?: { duplicate_checkin_minutes?: number } | null;
  renewal_settings?: { reminders_enabled?: boolean } | null;
}

export default function SettingsPage() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { show, node: toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) { setGym(j.data.gym); setSettings(j.data.settings ?? {}); }
        else setError(j.error?.message ?? "Failed to load settings");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const j = await res.json();
      show(j.message ?? "Settings saved", j.success ? "ok" : "err");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <><PageHeader title="Settings" /><Skeleton rows={5} /></>;
  if (error || !gym) return <ErrorState message={error ?? "Failed to load"} onRetry={() => window.location.reload()} />;

  return (
    <>
      <PageHeader title="Settings" action={<Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-h3">Gym profile</h2>
          <div className="mt-4 flex flex-col gap-4">
            <Input label="Gym name" value={gym.name} onChange={(e) => setGym({ ...gym, name: e.target.value })} />
            <Input label="Phone" value={gym.phone ?? ""} onChange={(e) => setGym({ ...gym, phone: e.target.value })} />
            <Input label="Email" type="email" value={gym.email ?? ""} onChange={(e) => setGym({ ...gym, email: e.target.value })} />
            <Input label="Address" value={gym.address ?? ""} onChange={(e) => setGym({ ...gym, address: e.target.value })} />
          </div>
        </Card>
        <Card>
          <h2 className="text-h3">Operations</h2>
          <div className="mt-4 flex flex-col gap-4">
            <Input label="No-show threshold (days)" type="number" min={1} max={365}
              value={gym.no_show_threshold_days}
              onChange={(e) => setGym({ ...gym, no_show_threshold_days: Number(e.target.value) })}
              hint="Members inactive beyond this many days enter the red list" />
            <Input label="Duplicate check-in window (minutes)" type="number" min={15} max={1440}
              value={settings.attendance_settings?.duplicate_checkin_minutes ?? 120}
              onChange={(e) => setSettings({
                ...settings,
                attendance_settings: { ...settings.attendance_settings, duplicate_checkin_minutes: Number(e.target.value) },
              })}
              hint="A member can check in again after this window" />
            <label className="flex items-center gap-3 text-small">
              <input type="checkbox" className="h-5 w-5 accent-[#F97316]"
                checked={settings.renewal_settings?.reminders_enabled ?? true}
                onChange={(e) => setSettings({
                  ...settings,
                  renewal_settings: { ...settings.renewal_settings, reminders_enabled: e.target.checked },
                })} />
              Send renewal reminders (14 / 7 / 3 days + expiry day)
            </label>
          </div>
        </Card>
      </div>
      {toast}
    </>
  );
}
