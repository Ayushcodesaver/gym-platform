"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, PageHeader, Skeleton, StatusBadge, ErrorState, useToast } from "@/components/ui";
import { Plus, Pencil } from "lucide-react";

interface AddOn {
  id: string; name: string; type: string; description: string | null;
  price: number; duration: number | null; session_count: number | null; stock: number | null; status: string;
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function AddOnsPage() {
  const [items, setItems] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; item: AddOn } | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/add-ons")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data);
        else setError(j.error?.message ?? "Failed to load add-ons");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Add-ons"
        action={<Button onClick={() => setModal({ mode: "create" })}><Plus size={16} aria-hidden /> New add-on</Button>} />
      {loading ? (
        <Skeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card>
          <p className="text-center text-small text-text-mid">
            No add-ons yet. Create personal training, diet plans, products or supplements.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-h3">{a.name}</h3>
                  <p className="mt-0.5 text-caption uppercase text-text-low">{a.type.replace("_", " ")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={a.status} />
                  <button aria-label={`Edit add-on ${a.name}`} onClick={() => setModal({ mode: "edit", item: a })}
                    className="flex h-11 w-11 items-center justify-center text-text-mid hover:text-text-hi">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
              {a.description && <p className="mt-2 text-small text-text-mid">{a.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-h3 font-bold tabular-nums">{inr(a.price)}</p>
                <p className="text-caption text-text-low">
                  {a.session_count ? `${a.session_count} sessions` : a.stock != null ? `${a.stock} in stock` : ""}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
      {modal && (
        <AddOnModal
          item={modal.mode === "edit" ? modal.item : null}
          onClose={() => setModal(null)}
          onDone={(msg) => { setModal(null); show(msg); load(); }}
        />
      )}
      {toast}
    </>
  );
}

function AddOnModal({ item, onClose, onDone }: { item: AddOn | null; onClose: () => void; onDone: (msg: string) => void }) {
  const editing = item !== null;
  const [form, setForm] = useState({
    name: item?.name ?? "", type: item?.type ?? "pt",
    description: item?.description ?? "", price: String(item?.price ?? ""),
    session_count: item?.session_count != null ? String(item.session_count) : "",
    stock: item?.stock != null ? String(item.stock) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!(Number(form.price) >= 0) || form.price === "") errs.price = "Price must be zero or more";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const payload = {
      name: form.name, type: form.type, price: Number(form.price),
      description: form.description || null,
      session_count: form.session_count ? Number(form.session_count) : null,
      stock: form.stock ? Number(form.stock) : null,
    };
    try {
      const res = await fetch(editing ? `/api/add-ons/${item!.id}` : "/api/add-ons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Add-on saved");
      else setErrors({ form: j.error?.message ?? "Could not save add-on" });
    } catch {
      setErrors({ form: "Network error — please retry." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? `Edit add-on — ${item!.name}` : "New add-on"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Name" required value={form.name} error={errors.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-small text-text-mid">
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="pt">Personal training</option>
              <option value="diet">Diet</option>
              <option value="product">Product</option>
              <option value="supplement">Supplement</option>
              <option value="service">Service</option>
            </select>
          </label>
          <Input label="Price (₹)" required type="number" min={0} value={form.price} error={errors.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Session count" type="number" min={1} value={form.session_count}
            onChange={(e) => setForm({ ...form, session_count: e.target.value })} hint="For PT / session packs" />
          <Input label="Stock" type="number" min={0} value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })} hint="For products" />
        </div>
        <Input label="Description" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {errors.form && <p role="alert" className="text-small text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save add-on"}</Button>
        </div>
      </div>
    </Modal>
  );
}
