import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useApi } from "@/lib/api";
import { theme, inr } from "@/lib/theme";
import { Button, Card, Skeleton, ErrorState, EmptyState } from "@/components/ui";
import { router } from "expo-router";

interface Plan { id: string; name: string; duration_days: number; price: number; discount: number; description: string | null; status: string }

/** Renew tab (§45): view plans → select → review → pay → server-verified result. */
export default function RenewScreen() {
  const api = useApi();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<Plan[]>("/api/plans")
      .then((d) => setPlans(d.filter((p) => p.status === "active")))
      .catch((e) => setError(e.message ?? "Could not load plans"))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);

  if (loading) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Skeleton height={90} /><Skeleton height={90} /><Skeleton height={90} />
      </ScrollView>
    );
  }
  if (error) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
        <ErrorState message={error} onRetry={load} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.title}>Choose membership</Text>
      {plans.length === 0 && (
        <EmptyState title="No plans published" body="Your gym hasn't published plans yet. Ask at the front desk." />
      )}
      {plans.map((p) => (
        <Card key={p.id}>
          <Text style={styles.plan}>{p.name}</Text>
          <Text style={styles.meta}>{p.duration_days} days{p.description ? ` · ${p.description}` : ""}</Text>
          <Text style={styles.price}>
            {inr(Number(p.price) - Number(p.discount ?? 0))}
            {Number(p.discount ?? 0) > 0 && (
              <Text style={styles.strike}>  {inr(p.price)}</Text>
            )}
          </Text>
          <Button
            title="Select"
            onPress={() => router.push({ pathname: "/renewal/[planId]", params: { planId: p.id, kind: "renewal" } })}
          />
        </Card>
      ))}

      <Text style={styles.section}>Extras</Text>
      <Button title="Browse add-ons" variant="secondary" onPress={() => router.push("/addons")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.textHi, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  plan: { color: theme.textHi, fontSize: 18, fontWeight: "600" },
  meta: { color: theme.textMid, fontSize: 13, marginTop: 2 },
  price: { color: theme.accent, fontSize: 20, fontWeight: "700", marginVertical: 10 },
  strike: { color: theme.textLow, fontSize: 13, fontWeight: "400", textDecorationLine: "line-through" },
  section: { color: theme.textHi, fontSize: 18, fontWeight: "600", marginTop: 12 },
});
