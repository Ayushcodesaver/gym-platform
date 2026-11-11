"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, PageHeader, Skeleton, StatusBadge, ErrorState, useToast } from "@/components/ui";
import { Plus, Pencil } from "lucide-react";

interface MembershipRow {
  id: string; status: string; start_date: string; expiry_date: string;
  members?: { first_name: string; last_name: string; member_code: string };
  plans?: { name: string };
}
interface Plan {
  id: string; name: string; duration_days: number; price: number; discount: number;
  description: string | null; benefits: string[] | null; status: string;
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function MembershipsPage() {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<{ mode: "create" } | { mode: "edit"; plan: Plan } | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/memberships").then((r) => r.json()),
      fetch("/api/plans").then((r) => r.json()),
    ])
      .then(([mj, pj]) => {
        if (mj.success) setRows(mj.data.memberships);
        if (pj.success) setPlans(pj.data);
        if (!mj.success) setError(mj.error?.message ?? "Failed to load memberships");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    const res = await fetch(`/api/memberships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    show(j.message ?? "Done", j.success ? "ok" : "err");
    if (j.success) load();
  };

  return (
    <>
      <PageHeader title="Memberships" />

      {/* Plans catalogue (master prompt §19) */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3">Plans</h2>
          <Button onClick={() => setPlanModal({ mode: "create" })}><Plus size={16} aria-hidden /> New plan</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-h3">{p.name}</h3>
                  <p className="text-caption text-text-low">{p.duration_days} days</p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={p.status} />
                  <button aria-label={`Edit plan ${p.name}`} onClick={() => setPlanModal({ mode: "edit", plan: p })}
                    className="flex h-11 w-11 items-center justify-center text-text-mid hover:text-text-hi">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-h3 font-bold tabular-nums">
                {inr(p.price)}{p.discount > 0 && <span className="ml-2 text-small font-normal text-warning line-through">{inr(p.discount)}</span>}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Membership table */}
      <Card className="p-0">
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
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/50">
                    <td className="px-5 py-3">
                      {m.members?.first_name} {m.members?.last_name}
                      <span className="ml-2 text-caption text-text-low">{m.members?.member_code}</span>
                    </td>
                    <td className="px-5 py-3 text-text-mid">{m.plans?.name}</td>
                    <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3 text-text-mid">{m.expiry_date}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {m.status === "pending" && <Button variant="secondary" className="!min-h-[36px] !px-3 text-small" onClick={() => act(m.id, "activate")}>Activate</Button>}
                        {m.status === "active" && <Button variant="secondary" className="!min-h-[36px] !px-3 text-small" onClick={() => act(m.id, "freeze")}>Freeze</Button>}
                        {m.status === "frozen" && <Button variant="secondary" className="!min-h-[36px] !px-3 text-small" onClick={() => act(m.id, "unfreeze")}>Unfreeze</Button>}
                        {(m.status === "active" || m.status === "pending" || m.status === "frozen") && (
                          <Button variant="danger" className="!min-h-[36px] !px-3 text-small" onClick={() => act(m.id, "cancel")}>Cancel</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {planModal && (
        <PlanModal
          plan={planModal.mode === "edit" ? planModal.plan : null}
          onClose={() => setPlanModal(null)}
          onDone={(msg) => { setPlanModal(null); show(msg); load(); }}
        />
      )}
      {toast}
    </>
  );
}

function PlanModal({ plan, onClose, onDone }: { plan: Plan | null; onClose: () => void; onDone: (msg: string) => void }) {
  const editing = plan !== null;
  const [form, setForm] = useState({
    name: plan?.name ?? "", duration_days: String(plan?.duration_days ?? 30),
    price: String(plan?.price ?? ""), discount: String(plan?.discount ?? 0),
    description: plan?.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Plan name is required";
    if (!(Number(form.duration_days) > 0)) errs.duration_days = "Duration must be a positive number of days";
    if (!(Number(form.price) >= 0) || form.price === "") errs.price = "Price must be zero or more";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const payload = {
      name: form.name, duration_days: Number(form.duration_days),
      price: Number(form.price), discount: Number(form.discount || 0),
      description: form.description || null,
    };
    try {
      const res = await fetch(editing ? `/api/plans/${plan!.id}` : "/api/plans", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Plan saved");
      else setErrors({ form: j.error?.message ?? "Could not save plan" });
    } catch {
      setErrors({ form: "Network error — please retry." });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    const j = await fetch(`/api/plans/${plan!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: plan!.status === "active" ? "inactive" : "active" }),
    }).then((r) => r.json());
    if (j.success) onDone(j.message ?? "Plan updated");
    else setErrors({ form: j.error?.message ?? "Could not update plan" });
    setSaving(false);
  };

  return (
    <Modal title={editing ? `Edit plan — ${plan!.name}` : "New plan"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Plan name" required value={form.name} error={errors.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (days)" required type="number" min={1} value={form.duration_days}
            error={errors.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
          <Input label="Price (₹)" required type="number" min={0} value={form.price}
            error={errors.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <Input label="Discount (₹)" type="number" min={0} value={form.discount}
          onChange={(e) => setForm({ ...form, discount: e.target.value })} />
        <Input label="Description" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {errors.form && <p role="alert" className="text-small text-danger">{errors.form}</p>}
        <div className="flex justify-between gap-2 pt-2">
          {editing ? (
            <Button variant="danger" onClick={deactivate} disabled={saving}>
              {plan!.status === "active" ? "Deactivate plan" : "Reactivate plan"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save plan"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
