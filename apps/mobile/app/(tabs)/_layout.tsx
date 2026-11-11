import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

/** Bottom nav: Home · Membership · Scan · Renew · Me (master prompt §41); Scan is most prominent. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMid,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}>
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="membership" options={{ title: "Membership", tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" color={color} size={size + 4} /> }} />
      <Tabs.Screen name="renew" options={{ title: "Renew", tabBarIcon: ({ color, size }) => <Ionicons name="refresh" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Me", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
      {/* Add-ons stay reachable from the Renew tab; hidden from the bar to keep ≤5 items */}
      <Tabs.Screen name="addons" options={{ href: null }} />
    </Tabs>
  );
}
