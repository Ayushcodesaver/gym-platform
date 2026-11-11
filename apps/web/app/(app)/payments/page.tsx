"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, PageHeader, Skeleton, StatusBadge, ErrorState, useToast } from "@/components/ui";

interface PaymentRow {
  id: string; amount: number; status: string; created_at: string;
  members?: { first_name: string; last_name: string; member_code: string };
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<PaymentRow | null>(null);
  const { show, node: toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/payments")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRows(j.data.payments);
        else setError(j.error?.message ?? "Failed to load payments");
      })
      .catch(() => setError("Network error — please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Payments" />
      <p className="mb-4 text-small text-text-mid">
        Payments are verified server-side — a checkout success screen alone never marks a payment as paid.
      </p>
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
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3">
                      {p.members?.first_name} {p.members?.last_name}
                      <span className="ml-2 text-caption text-text-low">{p.members?.member_code}</span>
                    </td>
                    <td className="px-5 py-3 font-medium tabular-nums">{inr(p.amount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-text-mid">
                      {new Date(p.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.status === "paid" && (
                        <Button variant="danger" className="!min-h-[36px] !px-3 text-small" onClick={() => setRefunding(p)}>
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {refunding && (
        <RefundModal payment={refunding} onClose={() => setRefunding(null)}
          onDone={(msg) => { setRefunding(null); show(msg); load(); }} />
      )}
      {toast}
    </>
  );
}

function RefundModal({ payment, onClose, onDone }: { payment: PaymentRow; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: payment.id, reason: reason || null }),
      });
      const j = await res.json();
      if (j.success) onDone(j.message ?? "Refund recorded");
      else setError(j.error?.message ?? "Refund failed");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Refund ${inr(payment.amount)}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-small text-text-mid">
          Full refund of {inr(payment.amount)} for {payment.members?.first_name} {payment.members?.last_name}.
          The payment is marked refunded — it is never deleted.
        </p>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}
          hint="Recorded in the audit trail" />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={saving}>{saving ? "Processing…" : "Process refund"}</Button>
        </div>
      </div>
    </Modal>
  );
}
