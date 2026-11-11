"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, PageHeader, Skeleton, StatusBadge, ErrorState, useToast } from "@/components/ui";
import { UserPlus, Pencil } from "lucide-react";

interface StaffRow {
  id: string; first_name: string; last_name: string | null; phone: string | null;
  role: string; status: string;
  user_profiles?: { role: string; clerk_user_id: string } | null;
}

export default function StaffPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/staff")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRows(j.data);
        else setError(j.error?.message ?? "Failed to load staff");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Staff"
        action={<Button onClick={() => setInviting(true)}><UserPlus size={16} aria-hidden /> Invite Staff</Button>} />
      <Card className="p-0">
        {loading ? (
          <div className="p-5"><Skeleton rows={3} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption uppercase text-text-low">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">App role</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3">{s.first_name} {s.last_name ?? ""}</td>
                    <td className="px-5 py-3 capitalize text-text-mid">{s.role.replace("_", " ")}</td>
                    <td className="px-5 py-3 capitalize text-text-mid">
                      {s.user_profiles?.role?.replace("_", " ") ?? "invite pending"}
                      <button aria-label={`Edit ${s.first_name}`} onClick={() => setEditing(s)}
                        className="ml-2 inline-flex h-9 w-9 items-center justify-center text-text-mid hover:text-text-hi">
                        <Pencil size={14} />
                      </button>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {inviting && (
        <InviteModal onClose={() => setInviting(false)}
          onDone={(msg) => { setInviting(false); show(msg); load(); }} />
      )}
      {editing && (
        <EditStaffModal staff={editing} onClose={() => setEditing(null)}
          onDone={(msg) => { setEditing(null); show(msg); load(); }} />
      )}
      {toast}
    </>
  );
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", role: "front_desk" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name, last_name: form.last_name || null,
          phone: form.phone || null, role: form.role,
        }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Staff added");
      else setError(j.error?.message ?? "Could not add staff");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Invite Staff" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="First name" required value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <Input label="Last name" value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <Input label="Phone" inputMode="numeric" maxLength={10}
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
        <label className="flex flex-col gap-1.5 text-small text-text-mid">
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="front_desk">Front desk</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.first_name || saving}>{saving ? "Saving…" : "Add staff"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditStaffModal({ staff, onClose, onDone }: { staff: StaffRow; onClose: () => void; onDone: (msg: string) => void }) {
  const [role, setRole] = useState(staff.user_profiles?.role ?? staff.role);
  const [status, setStatus] = useState(staff.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, status }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Staff updated");
      else setError(j.error?.message ?? "Could not update staff");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit staff — ${staff.first_name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-small text-text-mid">
          App role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="front_desk">Front desk</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-small text-text-mid">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </label>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </Modal>
  );
}
