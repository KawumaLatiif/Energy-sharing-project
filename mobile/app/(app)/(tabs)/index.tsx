import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Card, LoadingScreen, Screen, StatRow, Subtitle, Title } from "@/components/ui";
import { getMyMeters, getNotifications } from "@/lib/meter-api";
import { getLoanStats, getWalletBalance } from "@/lib/dashboard-api";
import type { MeterInfo } from "@/types/api";

export default function HomeScreen() {
  const { user } = useAuth();
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [wallet, setWallet] = useState<number | null>(null);
  const [loanOutstanding, setLoanOutstanding] = useState<number>(0);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, w, loans, alerts] = await Promise.all([
        getMyMeters(),
        getWalletBalance(),
        getLoanStats(),
        getNotifications().catch(() => ({ unread_count: 0, notifications: [] })),
      ]);
      setMeters(m);
      setWallet(w.balance ?? 0);
      setLoanOutstanding(loans.outstanding_balance ?? 0);
      setUnreadAlerts(alerts.unread_count ?? 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) return <LoadingScreen />;

  const primary = meters[0];

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <Screen>
        <Title>{`Hello, ${user?.first_name || "there"}`}</Title>
        <Subtitle>Your energy dashboard</Subtitle>

        {unreadAlerts > 0 && (
          <Card>
            <Text style={{ color: "#dc2626", fontWeight: "600" }}>
              {unreadAlerts} low-units alert{unreadAlerts > 1 ? "s" : ""} — check Account tab
            </Text>
          </Card>
        )}

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8, fontSize: 16 }}>
            {meters.length > 1 ? `Meters (${meters.length})` : "Meter"}
          </Text>
          {primary ? (
            <>
              <StatRow label="Primary meter" value={primary.meter_no} />
              <StatRow label="Type" value={primary.architecture} />
              <StatRow label="Balance" value={`${Number(primary.units).toFixed(2)} kWh`} />
              {primary.architecture === "STS" && primary.pending_units != null && (
                <StatRow label="Pending (wallet)" value={`${Number(primary.pending_units).toFixed(2)} kWh`} />
              )}
              {primary.architecture === "AMI" && (
                <StatRow
                  label="ThingsBoard"
                  value={primary.has_iot_token ? "Linked" : "Token missing"}
                />
              )}
              {meters.length > 1 && (
                <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                  +{meters.length - 1} more — open the Meters tab to manage all meters.
                </Text>
              )}
            </>
          ) : (
            <Text style={{ color: "#64748b" }}>
              No meter yet. Open the Meters tab to register an STS or AMI meter.
            </Text>
          )}
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8, fontSize: 16 }}>Wallet</Text>
          <StatRow label="Unit balance" value={`${(wallet ?? 0).toFixed(2)} kWh`} />
          <StatRow label="Loan outstanding" value={`UGX ${loanOutstanding.toLocaleString()}`} />
        </Card>
      </Screen>
    </ScrollView>
  );
}
