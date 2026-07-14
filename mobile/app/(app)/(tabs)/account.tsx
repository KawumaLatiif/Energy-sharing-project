import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/constants/config";
import { getTransactionHistory } from "@/lib/dashboard-api";
import { getNotifications, markNotificationsRead } from "@/lib/meter-api";
import type { MeterNotification, TransactionItem } from "@/types/api";
import {
  Button,
  Card,
  LoadingScreen,
  Screen,
  StatRow,
  Subtitle,
  Title,
} from "@/components/ui";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [notifications, setNotifications] = useState<MeterNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tx, alerts] = await Promise.all([
        getTransactionHistory().catch(() => []),
        getNotifications().catch(() => ({ notifications: [], unread_count: 0 })),
      ]);
      const txList = Array.isArray(tx)
        ? tx
        : ((tx as { results?: TransactionItem[] }).results ?? []);
      setTransactions(txList.slice(0, 10));
      setNotifications(alerts.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleLogout() {
    await signOut();
    router.replace("/(auth)/login");
  }

  async function markAllRead() {
    await markNotificationsRead(undefined, true);
    load();
  }

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Screen>
        <Title>My Account</Title>
        <Subtitle>Profile, alerts & history</Subtitle>

        <Card>
          <StatRow label="Name" value={`${user?.first_name} ${user?.last_name}`} />
          <StatRow label="Email" value={user?.email ?? ""} />
          <StatRow label="Role" value={user?.user_role ?? ""} />
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Low-units alerts</Text>
          {notifications.length === 0 ? (
            <Text style={{ color: "#64748b" }}>No alerts.</Text>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <Text key={n.id} style={{ marginBottom: 6, color: n.is_read ? "#64748b" : "#dc2626" }}>
                {n.meter_no ?? "Meter"}: {n.units_kwh} kWh — {new Date(n.occurred_at).toLocaleString()}
              </Text>
            ))
          )}
          {notifications.some((n) => !n.is_read) && (
            <Button label="Mark all read" variant="secondary" onPress={markAllRead} />
          )}
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Recent transactions</Text>
          {transactions.length === 0 ? (
            <Text style={{ color: "#64748b" }}>No transactions yet.</Text>
          ) : (
            transactions.map((t, i) => (
              <Text key={String(t.id ?? i)} style={{ marginBottom: 6, color: "#334155", fontSize: 13 }}>
                {(t.transaction_type ?? t.type ?? "TX")} — {t.amount_kwh ?? t.amount_ugx ?? "—"}{" "}
                {t.status ?? ""}
              </Text>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>API endpoint</Text>
          <Text style={{ fontSize: 12, fontFamily: "SpaceMono" }}>{API_URL}</Text>
        </Card>

        <Button label="Sign Out" onPress={handleLogout} variant="secondary" />
      </Screen>
    </ScrollView>
  );
}
