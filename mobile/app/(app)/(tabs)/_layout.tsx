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
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: "Home" }} />
      <Tabs.Screen name="my-meters" options={{ title: "My Meters", tabBarLabel: "Meters" }} />
      <Tabs.Screen name="buy-units" options={{ title: "TopUp Wallet", tabBarLabel: "TopUp" }} />
      <Tabs.Screen name="share" options={{ title: "Load / Share", tabBarLabel: "Load/Share" }} />
      <Tabs.Screen name="tokens" options={{ title: "Tokens & AMI", tabBarLabel: "Tokens" }} />
      <Tabs.Screen name="power-usage" options={{ title: "Energy Usage", tabBarLabel: "Usage" }} />
      <Tabs.Screen name="loans" options={{ title: "Loans", tabBarLabel: "Loans" }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarLabel: "Account" }} />
    </Tabs>
  );
}
