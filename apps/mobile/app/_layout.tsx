import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { SecureStore } from "@/lib/secure-store";
import { StatusBar } from "expo-status-bar";
import { Redirect, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

const tokenCache = {
  async getToken(key: string) {
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value); } catch { /* ignore */ }
  },
};

function Gate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>Gym</Text>
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""}
      tokenCache={tokenCache}>
      <StatusBar style="light" />
      <Gate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="renewal/[planId]" />
        </Stack>
      </Gate>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  logo: { color: theme.accent, fontSize: 32, fontWeight: "700", letterSpacing: -1 },
});
