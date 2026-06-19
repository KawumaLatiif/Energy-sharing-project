import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { getLoanStats } from "@/lib/dashboard-api";
import type { LoanStats } from "@/types/api";
import { Card, LoadingScreen, Screen, StatRow, Subtitle, Title } from "@/components/ui";

export default function LoansScreen() {
  const [stats, setStats] = useState<LoanStats>({
    pending_applications: 0,
    active_loans: 0,
    outstanding_balance: 0,
    has_blocking_loan: false,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getLoanStats();
      setStats(data);
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

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Screen>
        <Title>Loans</Title>
        <Subtitle>Energy loan overview</Subtitle>

        {stats.has_blocking_loan && (
          <Text style={{ color: "#dc2626", marginBottom: 12 }}>
            You have a pending or unpaid loan. Clear it before buying more units.
          </Text>
        )}

        <Card>
          <StatRow
            label="Pending applications"
            value={String(stats.pending_applications)}
          />
          <StatRow label="Active loans" value={String(stats.active_loans)} />
          <StatRow
            label="Outstanding balance"
            value={`UGX ${stats.outstanding_balance.toLocaleString()}`}
          />
        </Card>

        <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 20 }}>
          Apply for a new loan, disburse approved loans, and repay from the web portal
          for now. Full loan flows will be added in the next mobile release.
        </Text>
      </Screen>
    </ScrollView>
  );
}
