"use client";

import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  applyWalletToAmi,
  checkAmiUnits,
  generateToken,
  getMyMeters,
  getTokens,
} from "@/lib/meter-api";
import { ApiError } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  LoadingScreen,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import type { MeterInfo, MeterToken } from "@/types/api";

export default function TokensScreen() {
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [tokens, setTokens] = useState<MeterToken[]>([]);
  const [units, setUnits] = useState("1");
  const [amiUnits, setAmiUnits] = useState("");
  const [liveBalance, setLiveBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [amiLoading, setAmiLoading] = useState(false);
  const [error, setError] = useState("");
  const [newToken, setNewToken] = useState("");
  const [amiMessage, setAmiMessage] = useState("");

  const stsMeters = meters.filter((m) => m.architecture === "STS");
  const amiMeters = meters.filter((m) => m.architecture === "AMI");
  const [selectedSts, setSelectedSts] = useState("");
  const [selectedAmi, setSelectedAmi] = useState("");

  const stsMeter = stsMeters.find((m) => m.meter_no === selectedSts) ?? stsMeters[0];
  const amiMeter = amiMeters.find((m) => m.meter_no === selectedAmi) ?? amiMeters[0];

  const load = useCallback(async () => {
    try {
      const m = await getMyMeters();
      setMeters(m);
      const sts = m.filter((x) => x.architecture === "STS");
      const ami = m.filter((x) => x.architecture === "AMI");
      setSelectedSts((prev) => (prev && sts.some((x) => x.meter_no === prev) ? prev : sts[0]?.meter_no ?? ""));
      setSelectedAmi((prev) => (prev && ami.some((x) => x.meter_no === prev) ? prev : ami[0]?.meter_no ?? ""));
      const list = await getTokens();
      setTokens(list.filter((t) => !t.is_used));
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

  async function handleGenerate() {
    setError("");
    setNewToken("");
    const n = parseFloat(units);
    if (!n || n <= 0) {
      setError("Enter a valid kWh amount.");
      return;
    }
    if (!stsMeter) {
      setError("No STS meter selected.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateToken(n, stsMeter.meter_no);
      setNewToken(res.token);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not generate token.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCheckAmi() {
    if (!amiMeter) return;
    setAmiLoading(true);
    setError("");
    try {
      const res = await checkAmiUnits(amiMeter.meter_no);
      setLiveBalance(
        res.units_kwh != null ? `${res.units_kwh.toFixed(2)} kWh (ThingsBoard)` : res.message ?? "—"
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not read AMI balance.");
    } finally {
      setAmiLoading(false);
    }
  }

  async function handleApplyAmi() {
    if (!amiMeter) return;
    const n = parseFloat(amiUnits);
    if (!n || n <= 0) {
      setError("Enter kWh to apply.");
      return;
    }
    setAmiLoading(true);
    setError("");
    try {
      const res = await applyWalletToAmi(n, amiMeter.meter_no);
      setAmiMessage(res.message ?? "Units applied to AMI meter.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not apply units.");
    } finally {
      setAmiLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <Title>STS Tokens</Title>
      <Subtitle>Generate keypad tokens or manage AMI quick actions</Subtitle>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
        For full meter management use the Meters tab; for load/share use Load/Share tab.
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}

      {stsMeters.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>STS token generation</Text>
          {stsMeters.length > 1 && (
            <>
              <FieldLabel>Select STS meter</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {stsMeters.map((m) => (
                  <Button
                    key={m.meter_no}
                    label={m.label && m.label !== "Home" ? m.label : m.meter_no}
                    variant={stsMeter?.meter_no === m.meter_no ? "primary" : "secondary"}
                    onPress={() => setSelectedSts(m.meter_no)}
                  />
                ))}
              </View>
            </>
          )}
          {stsMeter && (
            <Text style={{ fontFamily: "SpaceMono", marginBottom: 8, color: colors.muted }}>
              {stsMeter.meter_no}
            </Text>
          )}
          <FieldLabel>Units from wallet (kWh)</FieldLabel>
          <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
          <Button label="Generate Token" onPress={handleGenerate} loading={generating} />
          {newToken ? (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: "#f0f9ff", borderRadius: 8 }}>
              <Text style={{ fontWeight: "600", marginBottom: 4 }}>Your token</Text>
              <Text style={{ fontSize: 18, letterSpacing: 1, fontFamily: "SpaceMono" }}>{newToken}</Text>
            </View>
          ) : null}
        </Card>
      )}

      {amiMeters.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>AMI quick actions</Text>
          {amiMeters.length > 1 && (
            <>
              <FieldLabel>Select AMI meter</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {amiMeters.map((m) => (
                  <Button
                    key={m.meter_no}
                    label={m.label && m.label !== "Home" ? m.label : m.meter_no}
                    variant={amiMeter?.meter_no === m.meter_no ? "primary" : "secondary"}
                    onPress={() => setSelectedAmi(m.meter_no)}
                  />
                ))}
              </View>
            </>
          )}
          {amiMeter && (
            <>
              {!amiMeter.has_iot_token && (
                <Text style={{ color: "#d97706", marginBottom: 8 }}>
                  ThingsBoard token not set — configure in Meters tab.
                </Text>
              )}
              <Button label="Check live balance" onPress={handleCheckAmi} loading={amiLoading} />
              {liveBalance ? <Text style={{ marginVertical: 8 }}>{liveBalance}</Text> : null}
              <FieldLabel>Apply wallet kWh to meter</FieldLabel>
              <Input value={amiUnits} onChangeText={setAmiUnits} keyboardType="decimal-pad" />
              <Button label="Apply to meter" onPress={handleApplyAmi} loading={amiLoading} />
              {amiMessage ? <Text style={{ color: "#16a34a", marginTop: 8 }}>{amiMessage}</Text> : null}
            </>
          )}
        </Card>
      )}

      {!stsMeters.length && !amiMeters.length && (
        <Text style={{ color: "#64748b" }}>Register a meter in the Meters tab first.</Text>
      )}

      {stsMeters.length > 0 && (
        <>
          <Text style={{ fontWeight: "600", marginBottom: 8, marginTop: 8 }}>Unused tokens</Text>
          <FlatList
            data={tokens}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            ListEmptyComponent={<Text style={{ color: "#64748b" }}>No unused tokens.</Text>}
            renderItem={({ item }) => (
              <Card>
                <Text style={{ fontFamily: "SpaceMono", fontSize: 16 }}>{item.token}</Text>
                <Text style={{ color: "#64748b", marginTop: 4 }}>{item.units} kWh</Text>
              </Card>
            )}
          />
        </>
      )}
    </Screen>
  );
}
