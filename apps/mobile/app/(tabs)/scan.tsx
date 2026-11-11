import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import { Button, ErrorState } from "@/components/ui";
import { theme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { router } from "expo-router";

type ScanState =
  | { kind: "camera" }
  | { kind: "checking" }
  | { kind: "success"; time: string; streak: number }
  | { kind: "duplicate" }
  | { kind: "invalid" }
  | { kind: "membership"; message: string }
  | { kind: "error"; message: string };

const SCREEN_W = Dimensions.get("window").width;

/** QR scanner (docs §20): simple orange frame, no neon; explicit per-failure states (§43). */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const api = useApi();
  const [state, setState] = useState<ScanState>({ kind: "camera" });
  const [lastScan, setLastScan] = useState(0);

  const checkIn = async (token: string) => {
    const now = Date.now();
    if (now - lastScan < 3000) return; // debounce duplicate scans of same frame
    setLastScan(now);
    setState({ kind: "checking" });
    try {
      const d = await api.post<{ checkedInAt: string; streak: { current_streak: number } }>(
        "/api/qr/checkin", { token },
      );
      setState({ kind: "success", time: new Date(d.checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), streak: d.streak.current_streak });
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      const msg = e instanceof Error ? e.message : "Check-in failed";
      if (code === "DUPLICATE_CHECKIN") setState({ kind: "duplicate" });
      else if (code === "INVALID_QR" || code === "GYM_MISMATCH") setState({ kind: "invalid" });
      else if (code === "MEMBERSHIP_EXPIRED" || code === "MEMBERSHIP_FROZEN" || code === "CONFLICT") {
        setState({ kind: "membership", message: msg });
      } else setState({ kind: "error", message: msg });
    }
  };

  if (permission && !permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Camera access is needed to scan your gym's QR code.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  if (state.kind !== "camera" && state.kind !== "checking") {
    return (
      <View style={styles.center}>
        {state.kind === "success" ? (
          <>
            <View style={styles.checkRing}><Text style={styles.check}>✓</Text></View>
            <Text style={styles.successTitle}>Check-in Complete</Text>
            <Text style={styles.hint}>{state.time} · {state.streak} day streak</Text>
            <Text style={styles.hint}>Today's attendance has been recorded.</Text>
          </>
        ) : state.kind === "duplicate" ? (
          <>
            <Text style={styles.successTitle}>Already checked in</Text>
            <Text style={styles.hint}>You checked in recently. See you next session!</Text>
          </>
        ) : state.kind === "invalid" ? (
          <>
            <Text style={styles.successTitle}>Invalid QR</Text>
            <Text style={styles.hint}>This code is invalid, expired, or belongs to a different gym. Ask the front desk for the current code.</Text>
          </>
        ) : state.kind === "membership" ? (
          <>
            <Text style={styles.successTitle}>Membership issue</Text>
            <Text style={styles.hint}>{state.message}</Text>
          </>
        ) : (
          <ErrorState message={state.message} onRetry={() => setState({ kind: "camera" })} />
        )}
        <Button
          title={state.kind === "success" || state.kind === "duplicate" ? "Done" : state.kind === "membership" ? "View membership" : "Scan again"}
          variant="secondary"
          onPress={() => {
            if (state.kind === "membership") router.push("/(tabs)/membership");
            else if (state.kind === "success" || state.kind === "duplicate") router.back();
            else setState({ kind: "camera" });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => checkIn(data)}
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>{state.kind === "checking" ? "Verifying…" : "Scan Gym QR"}</Text>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.hint}>Align the QR inside the frame</Text>
      </View>
    </View>
  );
}

const FRAME = SCREEN_W - 96;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: "rgba(11,13,16,0.55)" },
  title: { color: theme.textHi, fontSize: 20, fontWeight: "600" },
  frame: { width: FRAME, height: FRAME, borderWidth: 2, borderColor: theme.accent, borderRadius: 16 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: theme.accent, borderWidth: 4 },
  tl: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  tr: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  bl: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  br: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  hint: { color: theme.textMid, fontSize: 14, textAlign: "center" },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  checkRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: theme.accent, alignItems: "center", justifyContent: "center" },
  check: { color: theme.accent, fontSize: 32, fontWeight: "700" },
  successTitle: { color: theme.textHi, fontSize: 22, fontWeight: "700" },
});
