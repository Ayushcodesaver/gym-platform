"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, PageHeader, Skeleton, StatusBadge, ErrorState, useToast, Modal, Input } from "@/components/ui";
import { ArrowLeft, Phone, Snowflake, PlayCircle, XCircle, HandHeart } from "lucide-react";

interface Detail {
  member: { id: string; member_code: string; first_name: string; last_name: string | null; phone: string | null; email: string | null; join_date: string; status: string };
  memberships: Array<{ id: string; status: string; start_date: string; expiry_date: string; plans?: { name: string; price: number } }>;
  attendance: Array<{ id: string; checked_in_at: string; source: string }>;
  payments: Array<{ id: string; amount: number; status: string; created_at: string }>;
  followUps: Array<{ id: string; channel: string | null; outcome: string | null; notes: string | null; created_at: string }>;
  streak: { current_streak: number; best_streak: number } | null;
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

/** Member 360 (master prompt §40): profile + membership + attendance + payments + follow-ups + actions. */
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/members/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setError(j.error?.message ?? "Failed to load member");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const act = async (membershipId: string, action: string) => {
    const res = await fetch(`/api/memberships/${membershipId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    const j = await res.json();
    show(j.message ?? "Done", j.success ? "ok" : "err");
    if (j.success) load();
  };

  const setStatus = async (status: string) => {
    const res = await fetch(`/api/members/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const j = await res.json();
    show(j.message ?? "Done", j.success ? "ok" : "err");
    if (j.success) load();
  };

  if (loading) return <><PageHeader title="Member" /><Skeleton rows={6} /></>;
  if (error || !data || !data.member) return <ErrorState message={error ?? "Member not found"} onRetry={load} />;

  const { member, memberships, attendance, payments, followUps, streak } = data;
  const activeMembership = memberships.find((m) => m.status === "active") ?? memberships[0];

  return (
    <>
      <Link href="/members" className="mb-4 inline-flex items-center gap-1.5 text-small text-text-mid hover:text-text-hi">
        <ArrowLeft size={14} aria-hidden /> Back to members
      </Link>

      {/* Profile header (docs/desgin md §18) */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated border border-line text-h3">
          {member.first_name[0]?.toUpperCase()}
        </span>
        <div>
          <h1 className="text-h1">{member.first_name} {member.last_name ?? ""}</h1>
          <p className="text-small text-text-mid">
            Member #{member.member_code} · {member.phone} · joined {member.join_date}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {member.phone && (
            <a href={`tel:${member.phone}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-btn border border-line px-4 text-small text-text-mid hover:text-text-hi">
              <Phone size={14} aria-hidden /> Call
            </a>
          )}
          <Button variant="secondary" onClick={() => setFollowUpOpen(true)}>
            <HandHeart size={15} aria-hidden /> Follow up
          </Button>
          {member.status === "active" ? (
            <Button variant="danger" onClick={() => setStatus("inactive")}>Deactivate</Button>
          ) : (
            <Button variant="secondary" onClick={() => setStatus("active")}>Restore</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Membership card + actions */}
        <Card>
          <h2 className="text-h3">Membership</h2>
          {activeMembership ? (
            <>
              <p className="mt-2 text-h2 font-bold">{activeMembership.plans?.name ?? "—"}</p>
              <p className="text-small text-text-mid">
                {activeMembership.start_date} → {activeMembership.expiry_date}
              </p>
              <div className="mt-2"><StatusBadge status={activeMembership.status} /></div>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeMembership.status === "active" && (
                  <Button variant="secondary" onClick={() => act(activeMembership.id, "freeze")}>
                    <Snowflake size={14} aria-hidden /> Freeze
                  </Button>
                )}
                {activeMembership.status === "frozen" && (
                  <Button variant="secondary" onClick={() => act(activeMembership.id, "unfreeze")}>
                    <PlayCircle size={14} aria-hidden /> Unfreeze
                  </Button>
                )}
                {activeMembership.status !== "cancelled" && (
                  <Button variant="danger" onClick={() => act(activeMembership.id, "cancel")}>
                    <XCircle size={14} aria-hidden /> Cancel
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-small text-text-mid">No membership yet.</p>
          )}
          <div className="mt-4 border-t border-line pt-3 text-small text-text-mid">
            Streak: <span className="text-accent font-semibold">{streak?.current_streak ?? 0}</span> days ·
            best {streak?.best_streak ?? 0}
          </div>
        </Card>

        {/* Attendance history */}
        <Card>
          <h2 className="text-h3">Attendance</h2>
          <p className="text-caption text-text-low">{attendance.length} recent visits</p>
          <ul className="mt-3 max-h-56 divide-y divide-line overflow-y-auto text-small">
            {attendance.length === 0 && <li className="py-3 text-text-mid">No check-ins yet.</li>}
            {attendance.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span className="text-text-mid">{new Date(a.checked_in_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                <span className="uppercase text-caption text-text-low">{a.source}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Payments */}
        <Card>
          <h2 className="text-h3">Payments</h2>
          <ul className="mt-3 max-h-56 divide-y divide-line overflow-y-auto text-small">
            {payments.length === 0 && <li className="py-3 text-text-mid">No payments yet.</li>}
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium tabular-nums">{inr(p.amount)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-caption text-text-low">{new Date(p.created_at).toLocaleDateString("en-IN")}</span>
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Follow-up history */}
      <Card className="mt-4">
        <h2 className="text-h3">Follow-up history</h2>
        <ul className="mt-3 divide-y divide-line text-small">
          {followUps.length === 0 && <li className="py-3 text-text-mid">No follow-ups recorded.</li>}
          {followUps.map((f) => (
            <li key={f.id} className="py-2.5">
              <div className="flex items-center gap-3">
                <span className="capitalize text-text-hi">{f.channel?.replace("_", " ") ?? "—"}</span>
                {f.outcome && <span className="capitalize text-caption text-text-low">→ {f.outcome.replace("_", " ")}</span>}
                <span className="ml-auto text-caption text-text-low">{new Date(f.created_at).toLocaleDateString("en-IN")}</span>
              </div>
              {f.notes && <p className="mt-1 text-text-mid">{f.notes}</p>}
            </li>
          ))}
        </ul>
      </Card>

      {followUpOpen && (
        <FollowUpModal memberId={member.id} memberName={member.first_name}
          onClose={() => setFollowUpOpen(false)}
          onDone={(msg) => { setFollowUpOpen(false); show(msg); load(); }} />
      )}
      {toast}
    </>
  );
}

function FollowUpModal({ memberId, memberName, onClose, onDone }: {
  memberId: string; memberName: string; onClose: () => void; onDone: (msg: string) => void;
}) {
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
          member_id: memberId, channel, outcome,
          notes: notes || null,
          next_action_at: nextAction ? new Date(nextAction).toISOString() : null,
        }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Follow-up recorded");
      else setError(j.error?.message ?? "Could not save");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Follow up — ${memberName}`} onClose={onClose}>
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
        <Input label="Next action date" type="datetime-local" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</Button>
        </div>
      </div>
    </Modal>
  );
}
