import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Card, LoadingScreen, Screen, StatRow, Subtitle, Title } from "@/components/ui";
import { getMyMeter } from "@/lib/meter-api";
import { getLoanStats, getWalletBalance } from "@/lib/dashboard-api";
import type { MeterInfo } from "@/types/api";

export default function HomeScreen() {
  const { user } = useAuth();
  const [meter, setMeter] = useState<MeterInfo | null>(null);
  const [wallet, setWallet] = useState<number | null>(null);
  const [loanOutstanding, setLoanOutstanding] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, w, loans] = await Promise.all([
        getMyMeter(),
        getWalletBalance(),
        getLoanStats(),
      ]);
      setMeter(m);
      setWallet(w.balance ?? 0);
      setLoanOutstanding(loans.outstanding_balance ?? 0);
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

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Screen>
        <Title>{`Hello, ${user?.first_name || "there"}`}</Title>
        <Subtitle>Your energy dashboard</Subtitle>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8, fontSize: 16 }}>Meter</Text>
          {meter ? (
            <>
              <StatRow label="Meter no." value={meter.meter_no} />
              <StatRow label="Type" value={meter.architecture} />
              <StatRow
                label="Balance"
                value={`${Number(meter.units).toFixed(2)} kWh`}
              />
              {meter.architecture === "STS" && meter.pending_units != null && (
                <StatRow
                  label="Pending (wallet)"
                  value={`${Number(meter.pending_units).toFixed(2)} kWh`}
                />
              )}
            </>
          ) : (
            <Text style={{ color: "#64748b" }}>
              No meter registered yet. Register a meter from the web portal or contact support.
            </Text>
          )}
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8, fontSize: 16 }}>Wallet</Text>
          <StatRow label="Unit balance" value={`${(wallet ?? 0).toFixed(2)} kWh`} />
          <StatRow
            label="Loan outstanding"
            value={`UGX ${loanOutstanding.toLocaleString()}`}
          />
        </Card>
      </Screen>
    </ScrollView>
  );
}
