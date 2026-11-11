import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { theme } from "@/lib/theme";
import { Button, Card, Skeleton, StatusPill, ErrorState, EmptyState } from "@/components/ui";
import { router } from "expo-router";

interface Membership { id: string; status: string; start_date: string; expiry_date: string; plans?: { name: string; price: number } }
interface Payment { id: string; amount: number; status: string; created_at: string }

/** Membership screen: card (plan > expiry > status) + payment history. */
export default function MembershipScreen() {
  const api = useApi();
  const [data, setData] = useState<{ memberships: Membership[]; payments: Payment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ memberships: Membership[]; payments: Payment[] }>("/api/members/me")
      .then((d) => setData({ memberships: d.memberships, payments: d.payments }))
      .catch((e) => setError(e.message ?? "Could not load membership"))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);

  if (loading) return <View style={styles.wrap}><Skeleton height={140} /><Skeleton height={180} /></View>;
  if (error) return <View style={styles.wrap}><ErrorState message={error} onRetry={load} /></View>;

  const active = data?.memberships.find((m) => m.status === "active") ?? data?.memberships[0];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      {!active ? (
        <EmptyState title="No membership yet" body="Ask your gym's front desk to set you up, or pick a plan below." />
      ) : (
        <Card style={{ padding: 20 }}>
          <Text style={styles.label}>PLAN</Text>
          <Text style={styles.plan}>{active.plans?.name ?? "—"}</Text>
          <Text style={styles.meta}>
            Valid until {new Date(active.expiry_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
          <View style={{ marginTop: 10 }}><StatusPill status={active.status} /></View>
        </Card>
      )}

      <Button
        title="Renew membership"
        onPress={() => active && router.push({ pathname: "/renewal/[planId]", params: { planId: active.plans ? active.id : (active as unknown as { plan_id: string }).plan_id ?? active.id, kind: "renewal" } })}
      />

      <Text style={styles.section}>Payment history</Text>
      {(data?.payments ?? []).length === 0 ? (
        <Text style={styles.meta}>No payments yet.</Text>
      ) : (
        (data?.payments ?? []).map((p) => (
          <Card key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.amount}>₹{Number(p.amount).toLocaleString("en-IN")}</Text>
              <Text style={styles.meta}>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
            <StatusPill status={p.status} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  label: { color: theme.textLow, fontSize: 11, letterSpacing: 1.2 },
  plan: { color: theme.textHi, fontSize: 26, fontWeight: "700", marginTop: 4 },
  meta: { color: theme.textMid, fontSize: 14, marginTop: 6 },
  amount: { color: theme.textHi, fontSize: 16, fontWeight: "600" },
  section: { color: theme.textHi, fontSize: 18, fontWeight: "600", marginTop: 8 },
});
