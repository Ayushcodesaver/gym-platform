import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { theme, inr } from "@/lib/theme";
import { Button, Card, Skeleton, StatusPill, ErrorState } from "@/components/ui";

interface Membership {
  id: string; status: string; expiry_date: string;
  plans?: { name: string; price: number };
}
interface Streak { current_streak: number; best_streak: number; weekly_completed: number; weekly_target: number }

/** Mobile home (docs §31): greeting → membership card → Scan CTA → streak. */
export default function HomeScreen() {
  const api = useApi();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ member: unknown; memberships: Membership[]; streak: Streak | null }>("/api/members/me")
      .then((d) => {
        setMembership(d.memberships.find((m) => m.status === "active") ?? d.memberships[0] ?? null);
        setStreak(d.streak);
      })
      .catch((e) => setError(e.message ?? "Could not load your membership. Please retry."))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <Text style={styles.greeting}>Good {greeting()}, athlete</Text>

      {loading ? (
        <>
          <Skeleton height={120} />
          <Skeleton height={80} />
        </>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <Card style={{ padding: 20 }}>
            <Text style={styles.cardLabel}>MEMBERSHIP</Text>
            <Text style={styles.plan}>{membership?.plans?.name ?? "No plan"}</Text>
            {membership && (
              <>
                <View style={{ marginTop: 10 }}>
                  <StatusPill status={membership.status} />
                </View>
                <Text style={styles.expiry}>
                  Valid until {new Date(membership.expiry_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </>
            )}
          </Card>

          {/* Primary action — Scan QR (Fitts: large, thumb-reach) */}
          <Button title="Scan QR" onPress={() => {}} loading={false} />

          <Card>
            <Text style={styles.cardLabel}>CURRENT STREAK</Text>
            <Text style={styles.streak}>{streak?.current_streak ?? 0} days</Text>
            <Text style={styles.weekly}>
              {streak?.weekly_completed ?? 0} of {streak?.weekly_target ?? 3} this week · best {streak?.best_streak ?? 0} days
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  greeting: { color: theme.textHi, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  cardLabel: { color: theme.textLow, fontSize: 11, letterSpacing: 1.2 },
  plan: { color: theme.textHi, fontSize: 26, fontWeight: "700", marginTop: 4 },
  expiry: { color: theme.textMid, fontSize: 14, marginTop: 8 },
  streak: { color: theme.accent, fontSize: 28, fontWeight: "700", marginTop: 4 },
  weekly: { color: theme.textMid, fontSize: 13, marginTop: 6 },
});
void inr;
