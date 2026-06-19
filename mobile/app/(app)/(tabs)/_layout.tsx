import { Tabs } from "expo-router";
import { colors } from "@/components/ui";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarLabel: "Home" }}
      />
      <Tabs.Screen
        name="buy-units"
        options={{ title: "Buy Units", tabBarLabel: "Buy" }}
      />
      <Tabs.Screen
        name="tokens"
        options={{ title: "Tokens", tabBarLabel: "Tokens" }}
      />
      <Tabs.Screen
        name="loans"
        options={{ title: "Loans", tabBarLabel: "Loans" }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarLabel: "Account" }}
      />
    </Tabs>
  );
}
