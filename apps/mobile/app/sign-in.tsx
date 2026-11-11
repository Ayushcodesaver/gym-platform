import { StyleSheet, Text, View } from "react-native";
import { useOAuth, useAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { isSignedIn } = useAuth();

  if (isSignedIn) return null; // root gate redirects to (tabs)

  const onPress = async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
    } catch {
      // error surface stays calm; retry by tapping again
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to check in, track your streak and renew your membership.</Text>
      <Button title="Continue with Google" onPress={onPress} />
      <Text style={styles.hint}>
        Your gym invites you by phone or email — use the same method to sign in.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: "center", gap: 16 },
  title: { color: theme.textHi, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  sub: { color: theme.textMid, fontSize: 15, lineHeight: 22 },
  hint: { color: theme.textLow, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
