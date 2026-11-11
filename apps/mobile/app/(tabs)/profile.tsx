import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { theme } from "@/lib/theme";
import { Card, Skeleton, Button } from "@/components/ui";
import { useClerk } from "@clerk/clerk-expo";

interface Me {
  member: { first_name: string; last_name: string | null; member_code: string; phone: string | null };
  recentCheckIns: string[];
}
interface Notification { id: string; title: string; body: string; status: string; created_at: string }

export default function ProfileScreen() {
  const api = useApi();
  const { signOut } = useClerk();
  const [me, setMe] = useState<Me | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Me>("/api/members/me").then(setMe).catch(() => setMe(null)),
      api.get<Notification[]>("/api/notifications").then(setNotifications).catch(() => setNotifications([])),
    ]).finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => n.status === "queued" || n.status === "pending");
    if (unread.length === 0) return;
    await api.patch("/api/notifications", { notification_ids: unread.map((n) => n.id) }).catch(() => null);
    load();
  };

  if (loading) return <View style={styles.wrap}><Skeleton /><Skeleton height={20} /></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <Card style={{ padding: 20 }}>
        <Text style={styles.name}>{me?.member.first_name} {me?.member.last_name ?? ""}</Text>
        <Text style={styles.meta}>Member #{me?.member.member_code}</Text>
        {me?.member.phone ? <Text style={styles.meta}>{me.member.phone}</Text> : null}
      </Card>

      <Text style={styles.section}>Recent check-ins</Text>
      {(me?.recentCheckIns ?? []).map((c) => (
        <Card key={c} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.meta}>
            {new Date(c).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
          <Text style={styles.meta}>{new Date(c).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Text>
        </Card>
      ))}
      {(me?.recentCheckIns ?? []).length === 0 && <Text style={styles.meta}>No check-ins yet — scan your gym's QR to start a streak.</Text>}

      <Text style={styles.section}>Notifications</Text>
      {notifications.length === 0 ? (
        <Text style={styles.meta}>You're all caught up.</Text>
      ) : (
        <>
          {notifications.slice(0, 10).map((n) => (
            <Card key={n.id}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.meta}>{n.body}</Text>
              <Text style={styles.notifDate}>
                {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {n.status}
              </Text>
            </Card>
          ))}
          {notifications.some((n) => n.status === "queued" || n.status === "pending") && (
            <Button title="Mark all as read" variant="secondary" onPress={markAllRead} />
          )}
        </>
      )}

      <View style={{ marginTop: 8 }}>
        <Button title="Sign out" variant="danger" onPress={() => signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  name: { color: theme.textHi, fontSize: 24, fontWeight: "700" },
  meta: { color: theme.textMid, fontSize: 14, marginTop: 4 },
  notifTitle: { color: theme.textHi, fontSize: 15, fontWeight: "600" },
  notifDate: { color: theme.textLow, fontSize: 11, marginTop: 4, textTransform: "capitalize" },
  section: { color: theme.textHi, fontSize: 18, fontWeight: "600", marginTop: 8 },
});
