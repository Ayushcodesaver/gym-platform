import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useApi } from "@/lib/api";
import { theme, inr } from "@/lib/theme";
import { Button, Card, Skeleton, ErrorState } from "@/components/ui";

type State =
  | { kind: "loading" }
  | { kind: "review"; summary: { label: string; value: string }[]; amount: number; memberId: string; refId: string; paymentKind: "renewal" | "add_on" }
  | { kind: "pending"; paymentId: string }
  | { kind: "success" }
  | { kind: "failed"; message: string };

/**
 * Checkout (docs §24): order summary → pay → pending → verified success.
 * The success state appears ONLY after server verification, never on client say-so.
 */
export default function RenewalScreen() {
  const { planId, kind } = useLocalSearchParams<{ planId: string; kind?: string }>();
  const api = useApi();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    setState({ kind: "loading" });
    const isAddon = kind === "add_on";
    const path = isAddon ? "/api/add-ons" : "/api/plans";
    api.get<{ id: string; name: string; price: number; discount?: number }[]>(path)
      .then((items) => {
        const item = items.find((i) => i.id === planId);
        if (!item) { setState({ kind: "failed", message: "This plan is no longer available." }); return; }
        return api
          .get<{ member: { id: string }; memberships: { id: string; plan_id: string }[] }>("/api/members/me")
          .then((me) => {
            const membership = me.memberships.find((m) => m.plan_id === item.id) ?? me.memberships[0];
            if (!isAddon && !membership) {
              setState({ kind: "failed", message: "No membership found — ask your gym's front desk for help." });
              return;
            }
            const amount = Number(item.price) - Number(item.discount ?? 0);
            setState({
              kind: "review",
              summary: [
                { label: item.name, value: inr(Number(item.price)) },
                ...(Number(item.discount ?? 0) > 0 ? [{ label: "Discount", value: `-${inr(Number(item.discount))}` }] : []),
              ],
              amount,
              memberId: me.member.id,
              refId: isAddon ? item.id : membership!.id,
              paymentKind: isAddon ? "add_on" : "renewal",
            });
          });
      })
      .catch((e) => setState({ kind: "failed", message: e.message ?? "Could not load checkout" }));
  }, [api, planId, kind]);
  useEffect(load, [load]);

  const pay = async () => {
    if (state.kind !== "review") return;
    setPaying(true);
    try {
      const intent = await api.post<{ paymentId: string }>("/api/payments", {
        member_id: state.memberId,
        plan_id: state.paymentKind === "renewal" ? planId : undefined,
        type: state.paymentKind,
        add_on_id: state.paymentKind === "add_on" ? planId : undefined,
        quantity: 1,
      });
      setState({ kind: "pending", paymentId: intent.paymentId });
      // In production this is where the provider SDK (Razorpay/Stripe) opens checkout.
      // Fulfilment happens ONLY via the signed server webhook — the client can never
      // mark a payment as paid, so we stay in "pending" until verification lands.
    } catch (e) {
      setState({ kind: "failed", message: e instanceof Error ? e.message : "Payment failed" });
    } finally {
      setPaying(false);
    }
  };

  if (state.kind === "loading") {
    return <View style={styles.wrap}><Skeleton height={160} /><Skeleton height={56} /></View>;
  }
  if (state.kind === "failed") {
    return <View style={styles.wrap}><ErrorState message={state.message} onRetry={() => router.back()} /></View>;
  }
  if (state.kind === "success") {
    return (
      <View style={[styles.wrap, styles.center]}>
        <View style={styles.checkRing}><Text style={styles.check}>✓</Text></View>
        <Text style={styles.successTitle}>Payment Successful</Text>
        <Text style={styles.meta}>Your membership has been extended.</Text>
        <Button title="Done" onPress={() => router.back()} />
      </View>
    );
  }
  if (state.kind === "pending") {
    return (
      <View style={[styles.wrap, styles.center]}>
        <Text style={styles.successTitle}>Payment pending</Text>
        <Text style={styles.meta}>We'll confirm as soon as the payment gateway verifies it. You can close this screen.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={styles.title}>Order Summary</Text>
      <Card>
        {state.summary.map((s) => (
          <View key={s.label} style={styles.row}>
            <Text style={styles.meta}>{s.label}</Text>
            <Text style={styles.amount}>{s.value}</Text>
          </View>
        ))}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{inr(state.amount)}</Text>
        </View>
      </Card>
      <Button title={`Pay ${inr(state.amount)}`} onPress={pay} loading={paying} />
      <Text style={styles.footnote}>Payments are verified by the gym before your membership is extended.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  title: { color: theme.textHi, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  totalRow: { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 6, paddingTop: 14 },
  meta: { color: theme.textMid, fontSize: 15 },
  amount: { color: theme.textHi, fontSize: 15, fontWeight: "500", fontVariant: ["tabular-nums"] },
  totalLabel: { color: theme.textHi, fontSize: 16, fontWeight: "600" },
  total: { color: theme.accent, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  footnote: { color: theme.textLow, fontSize: 12, textAlign: "center", lineHeight: 18 },
  checkRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: theme.accent, alignItems: "center", justifyContent: "center" },
  check: { color: theme.accent, fontSize: 32, fontWeight: "700" },
  successTitle: { color: theme.textHi, fontSize: 22, fontWeight: "700" },
});
