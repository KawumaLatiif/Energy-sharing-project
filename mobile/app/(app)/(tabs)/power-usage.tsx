import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Button,
  Card,
  LoadingScreen,
  Screen,
  StatRow,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { getMyMeters } from "@/lib/meter-api";
import { getPowerUsage, type UsagePeriod } from "@/lib/usage-api";
import type { MeterInfo, PowerUsageReport } from "@/types/api";

const PERIODS: { key: UsagePeriod; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BarChartSimple({
  data,
  maxHeight = 120,
}: {
  data: Array<{ label: string; value: number }>;
  maxHeight?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 0.1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: maxHeight + 24, marginTop: 8 }}>
      {data.map((item) => {
        const h = Math.max(4, (item.value / max) * maxHeight);
        return (
          <View key={item.label} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                width: "80%",
                height: h,
                backgroundColor: colors.primary,
                borderRadius: 4,
                opacity: item.value > 0 ? 1 : 0.2,
              }}
            />
            <Text
              numberOfLines={1}
              style={{ fontSize: 9, color: colors.muted, marginTop: 4, textAlign: "center" }}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function PowerUsageScreen() {
  const [amiMeters, setAmiMeters] = useState<MeterInfo[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<string | undefined>();
  const [period, setPeriod] = useState<UsagePeriod>("week");
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<PowerUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const meters = await getMyMeters();
      const ami = meters.filter((m) => m.architecture === "AMI");
      setAmiMeters(ami);
      const meterNo = selectedMeter ?? ami[0]?.meter_no;
      if (!ami.length) {
        setReport({ eligible: false, message: "This is only for AMI meter users." });
        return;
      }
      const data = await getPowerUsage({
        period,
        meter_no: meterNo,
        year: period === "year" || period === "month" ? year : undefined,
        month: period === "month" ? new Date().getMonth() + 1 : undefined,
      });
      setReport(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedMeter, year]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) return <LoadingScreen />;

  if (!amiMeters.length) {
    return (
      <Screen>
        <Title>Energy Usage</Title>
        <Subtitle>AMI meter analytics</Subtitle>
        <Card>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            This is only for AMI meter users. Your account has STS (token-based) meters only.
          </Text>
        </Card>
      </Screen>
    );
  }

  const chartData =
    period === "year" && report?.monthly?.length
      ? report.monthly.map((m) => ({ label: m.label, value: m.total_kwh }))
      : (report?.daily ?? [])
          .filter((d) => d.kwh_used > 0)
          .slice(-7)
          .map((d) => ({ label: formatDate(d.date), value: d.kwh_used }));

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <Screen>
        <Title>Energy Usage</Title>
        <Subtitle>{`${report?.meter_label || report?.meter_no || "AMI meter"} · kWh consumed`}</Subtitle>

        {amiMeters.length > 1 && (
          <Card>
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>Meter</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {amiMeters.map((m) => (
                <Pressable
                  key={m.meter_no}
                  onPress={() => setSelectedMeter(m.meter_no)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor:
                      (selectedMeter ?? amiMeters[0]?.meter_no) === m.meter_no
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        (selectedMeter ?? amiMeters[0]?.meter_no) === m.meter_no
                          ? "#fff"
                          : colors.text,
                      fontSize: 13,
                    }}
                  >
                    {m.label || m.meter_no}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: period === p.key ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: period === p.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: period === p.key ? "#fff" : colors.text, fontWeight: "600" }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {period === "year" && report?.available_years && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {report.available_years.map((y) => (
              <Pressable
                key={y}
                onPress={() => setYear(y)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: year === y ? colors.primaryDark : colors.border,
                }}
              >
                <Text style={{ color: year === y ? "#fff" : colors.text }}>{y}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {report?.summary && (
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Summary</Text>
            <StatRow label="Total used" value={`${report.summary.total_kwh} kWh`} />
            <StatRow label="Daily average" value={`${report.summary.average_daily_kwh} kWh`} />
            <StatRow label="Peak day" value={`${report.summary.peak_day_kwh} kWh`} />
            <StatRow label="Lowest day" value={`${report.summary.lowest_day_kwh} kWh`} />
            {report.data_source && (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                Data source: {report.data_source}
              </Text>
            )}
          </Card>
        )}

        {chartData.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              {period === "year" ? "Monthly chart" : "Daily chart"}
            </Text>
            <BarChartSimple data={chartData} />
          </Card>
        )}

        {report?.daily && period !== "year" && (
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Daily breakdown</Text>
            {[...report.daily].reverse().map((row) => (
              <View
                key={row.date}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.muted }}>{formatDate(row.date)}</Text>
                <Text style={{ fontWeight: "600" }}>{row.kwh_used.toFixed(2)} kWh</Text>
              </View>
            ))}
          </Card>
        )}

        <Button label="Refresh" onPress={() => { setRefreshing(true); load(); }} loading={refreshing} />
      </Screen>
    </ScrollView>
  );
}
