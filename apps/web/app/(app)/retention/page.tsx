"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, PageHeader, Skeleton, ErrorState, useToast } from "@/components/ui";
import { AlertTriangle, Phone } from "lucide-react";

interface Case {
  id: string; member_id: string; absent_days: number; last_attendance_at: string | null; status: string;
  members?: { first_name: string; last_name: string; member_code: string; phone: string | null };
}

/** Retention = red list (no-show cases) + follow-up recording. Calm, not alarming (docs §26). */
export default function RetentionPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<Case | null>(null);
  const [scanning, setScanning] = useState(false);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/no-shows")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCases(j.data);
        else setError(j.error?.message ?? "Failed to load red list");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const j = await fetch("/api/no-shows", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scan: true }),
      }).then((r) => r.json());
      show(j.message ?? "Scan complete", j.success ? "ok" : "err");
      if (j.success) load();
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Retention"
        action={<Button variant="secondary" onClick={scan} disabled={scanning}>
          {scanning ? "Scanning…" : "Run no-show scan"}
        </Button>}
      />
      <p className="mb-4 text-small text-text-mid">
        Active members with no attendance beyond the gym&apos;s threshold appear here. A returning
        check-in resolves their case automatically.
      </p>

      {loading ? (
        <Skeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : cases.length === 0 ? (
        <Card>
          <p className="text-center text-small text-text-mid">
            No members need attention right now. Run a scan to re-check.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cases.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-h3">{c.members?.first_name} {c.members?.last_name}</p>
                  <p className="text-caption text-text-low">{c.members?.member_code}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-btn border border-warning/40 bg-warning/10 px-2.5 py-1 text-caption text-warning">
                  <AlertTriangle size={13} aria-hidden /> {c.absent_days} days
                </span>
              </div>
              <p className="mt-2 text-small text-text-mid">
                Last visited: {c.last_attendance_at ? new Date(c.last_attendance_at).toLocaleDateString("en-IN") : "never"}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setFollowUp(c)}>Follow Up</Button>
                {c.members?.phone && (
                  <a href={`tel:${c.members.phone}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-btn border border-line px-4 text-small text-text-mid hover:text-text-hi">
                    <Phone size={14} aria-hidden /> Call
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {followUp && (
        <FollowUpModal member={followUp} onClose={() => setFollowUp(null)}
          onDone={(msg) => { setFollowUp(null); show(msg); load(); }} />
      )}
      {toast}
    </>
  );
}

function FollowUpModal({ member, onClose, onDone }: { member: Case; onClose: () => void; onDone: (msg: string) => void }) {
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("no_response");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: member.member_id, channel, outcome,
          notes: notes || null,
          next_action_at: nextAction ? new Date(nextAction).toISOString() : null,
        }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Follow-up recorded");
      else setError(j.error?.message ?? "Could not save follow-up");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Follow up — ${member.members?.first_name ?? "Member"}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-small text-text-mid">
          Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="in_person">In person</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-small text-text-mid">
          Outcome
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="will_return">Will return</option>
            <option value="injured">Injured</option>
            <option value="travelling">Travelling</option>
            <option value="timing_issue">Timing issue</option>
            <option value="unhappy">Unhappy</option>
            <option value="no_response">No response</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input label="Next action date" type="datetime-local" value={nextAction}
          onChange={(e) => setNextAction(e.target.value)} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</Button>
        </div>
      </div>
    </Modal>
  );
}
