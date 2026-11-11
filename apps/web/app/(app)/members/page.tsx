"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, StatusBadge, useToast } from "@/components/ui";
import { Plus, MoreHorizontal } from "lucide-react";

interface Member {
  id: string; member_code: string; first_name: string; last_name: string | null;
  phone: string | null; status: string; membership_status: string | null;
  plan_name: string | null; expiry_date: string | null; last_check_in_at: string | null;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback((query = "") => {
    setLoading(true);
    setError(null);
    fetch(`/api/members${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMembers(j.data.members);
        else setError(j.error?.message ?? "Failed to load members");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);

  // Debounced server-side search (master prompt §58)
  const onSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 350);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setMenuFor(null);
    const j = await fetch(`/api/members/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).then((r) => r.json());
    show(j.message ?? "Done", j.success ? "ok" : "err");
    if (j.success) load(q);
  };

  return (
    <>
      <PageHeader
        title="Members"
        action={<Button onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Add Member</Button>}
      />

      <div className="mb-4 max-w-md">
        <Input
          label="Search members"
          id="member-search"
          placeholder="Name, code or phone"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          hint="Search runs automatically as you type"
        />
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-5"><Skeleton rows={5} /></div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(q)} />
        ) : members.length === 0 ? (
          <EmptyState
            title="No members yet"
            body="Add your first member to start managing memberships and attendance."
            action={<Button onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Add Member</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption uppercase text-text-low">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3">Last check-in</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/50">
                    <td className="px-5 py-3">
                      <Link href={`/members/${m.id}`} className="font-medium hover:text-accent">
                        {m.first_name} {m.last_name ?? ""}
                      </Link>
                      <div className="text-caption text-text-low">{m.member_code} · {m.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-text-mid">{m.plan_name ?? "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={m.membership_status ?? m.status} /></td>
                    <td className="px-5 py-3 text-text-mid">{m.expiry_date ?? "—"}</td>
                    <td className="px-5 py-3 text-text-mid">
                      {m.last_check_in_at ? new Date(m.last_check_in_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="relative px-5 py-3 text-right">
                      <button aria-label={`Actions for ${m.first_name}`} aria-expanded={menuFor === m.id}
                        onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                        className="inline-flex h-11 w-11 items-center justify-center text-text-mid hover:text-text-hi">
                        <MoreHorizontal size={16} />
                      </button>
                      {menuFor === m.id && (
                        <div role="menu" className="absolute right-5 z-10 mt-1 w-40 rounded-card border border-line bg-surface p-1 shadow-xl">
                          <Link href={`/members/${m.id}`} role="menuitem" className="block rounded px-3 py-2.5 text-small hover:bg-elevated">View details</Link>
                          {m.status === "active" ? (
                            <button role="menuitem" onClick={() => setStatus(m.id, "inactive")}
                              className="block w-full rounded px-3 py-2.5 text-left text-small text-danger hover:bg-elevated">Deactivate</button>
                          ) : (
                            <button role="menuitem" onClick={() => setStatus(m.id, "active")}
                              className="block w-full rounded px-3 py-2.5 text-left text-small hover:bg-elevated">Restore</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && <AddMemberModal onClose={() => setAdding(false)} onDone={(msg) => { setAdding(false); show(msg); load(q); }} />}
      {toast}
    </>
  );
}

function AddMemberModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = "First name is required";
    if (!/^[6-9]\d{9}$/.test(form.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, last_name: form.last_name || null, email: form.email || null }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Member added");
      else setErrors({ form: j.error?.message ?? "Could not add member" });
    } catch {
      setErrors({ form: "Network error — please retry." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Member" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="First name" required value={form.first_name} error={errors.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <Input label="Last name" value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <Input label="Phone" required inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX"
          value={form.phone} error={errors.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
        <Input label="Email" type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.form && <p role="alert" className="text-small text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add Member"}</Button>
        </div>
      </div>
    </Modal>
  );
}
