import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useApi } from "@/lib/api";
import { theme, inr } from "@/lib/theme";
import { Button, Card, Skeleton, ErrorState, EmptyState } from "@/components/ui";
import { router } from "expo-router";

interface AddOn {
  id: string; name: string; type: string; description: string | null;
  price: number; session_count: number | null;
}

export default function AddOnsScreen() {
  const api = useApi();
  const [items, setItems] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<AddOn[]>("/api/add-ons")
      .then(setItems)
      .catch((e) => setError(e.message ?? "Could not load add-ons"))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);

  if (loading) return <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 12 }}><Skeleton /><Skeleton /><Skeleton /></ScrollView>;
  if (error) return <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}><ErrorState message={error} onRetry={load} /></ScrollView>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Your gym hasn't published any add-ons. Check back later." />
      ) : (
        items.map((a) => (
          <Card key={a.id}>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={styles.type}>{a.type.replace("_", " ").toUpperCase()}</Text>
            {a.description ? <Text style={styles.desc}>{a.description}</Text> : null}
            <Text style={styles.price}>{inr(a.price)}{a.session_count ? ` · ${a.session_count} sessions` : ""}</Text>
            <Button title="Buy" onPress={() => router.push({ pathname: "/renewal/[planId]", params: { planId: a.id, kind: "add_on" } })} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  name: { color: theme.textHi, fontSize: 18, fontWeight: "600" },
  type: { color: theme.textLow, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  desc: { color: theme.textMid, fontSize: 14, marginTop: 8, lineHeight: 20 },
  price: { color: theme.accent, fontSize: 18, fontWeight: "700", marginVertical: 12 },
});
