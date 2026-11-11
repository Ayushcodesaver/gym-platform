import { theme } from "@/lib/theme";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

/** Shared primitives: 44pt touch targets, orange accent only for primary action (docs §33). */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = "primary", disabled, loading,
}: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "danger";
  disabled?: boolean; loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        (disabled || loading) && styles.btnDisabled,
        pressed && { opacity: 0.8 }, // tap feedback ≤150ms, no layout shift (pro-rules)
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : theme.textHi} />
      ) : (
        <Text style={[styles.btnText, variant === "primary" && { color: "#FFFFFF" }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function StatusPill({ status }: { status: string }) {
  const color =
    status === "active" || status === "paid" ? theme.accent
    : status === "pending" || status === "frozen" || status === "in_progress" ? theme.warning
    : status === "expired" || status === "failed" || status === "cancelled" || status === "open" ? theme.danger
    : theme.textMid;
  const label = status.replace("_", " ");
  return (
    <View style={styles.pill} accessibilityLabel={`Status: ${label}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color: theme.textMid }]}>{label}</Text>
    </View>
  );
}

export function Skeleton({ height = 56 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.body, { color: theme.textMid, textAlign: "center" }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.h3}>{title}</Text>
      <Text style={[styles.body, { color: theme.textMid, textAlign: "center", marginTop: 6 }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 16,
  },
  btn: {
    minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, borderWidth: 1, borderColor: "transparent",
  },
  btnPrimary: { backgroundColor: theme.accent },
  btnSecondary: { backgroundColor: theme.elevated, borderColor: theme.border },
  btnDanger: { backgroundColor: "transparent", borderColor: theme.danger },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.textHi, fontSize: 16, fontWeight: "500" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, textTransform: "capitalize" },
  skeleton: { borderRadius: 10, backgroundColor: theme.elevated, opacity: 0.6 },
  center: { alignItems: "center", paddingVertical: 32, gap: 12 },
  h3: { color: theme.textHi, fontSize: 18, fontWeight: "600" },
  body: { fontSize: 14 },
});
