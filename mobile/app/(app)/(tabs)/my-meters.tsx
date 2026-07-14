import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  applyWalletToAmi,
  checkAmiUnits,
  deleteMeter,
  generateToken,
  getMyMeters,
  registerMeter,
} from "@/lib/meter-api";
import { isValidMeterNumber, METER_NO_MAX_LENGTH } from "@/lib/meter-validation";
import { getWalletBalance } from "@/lib/dashboard-api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  LoadingScreen,
  Screen,
  StatRow,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import type { MeterInfo } from "@/types/api";

export default function MyMetersScreen() {
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [selected, setSelected] = useState<MeterInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveBalance, setLiveBalance] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadAmount, setLoadAmount] = useState("1");
  const [newToken, setNewToken] = useState("");

  const [formArch, setFormArch] = useState<"STS" | "AMI">("STS");
  const [formLabel, setFormLabel] = useState("");
  const [formMeterNo, setFormMeterNo] = useState("");
  const [formToken, setFormToken] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([getMyMeters(), getWalletBalance()]);
      setMeters(m);
      setWalletBalance(w.balance ?? 0);
      setSelected((prev) => {
        if (prev && m.some((x) => x.meter_no === prev.meter_no)) return prev;
        return m[0] ?? null;
      });
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

  async function handleCheckUnits() {
    if (!selected || selected.architecture !== "AMI") return;
    setActionLoading(true);
    setError("");
    setLiveBalance(null);
    try {
      const res = await checkAmiUnits(selected.meter_no);
      if (res.units_kwh != null) {
        setLiveBalance(`${res.units_kwh.toFixed(2)} kWh (ThingsBoard live)`);
      } else {
        setError(res.message ?? "Could not read live balance.");
      }
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check units failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLoadConfirm() {
    if (!selected) return;
    const n = parseFloat(loadAmount);
    if (!n || n <= 0) {
      setError("Enter a valid kWh amount.");
      return;
    }
    if (n > walletBalance) {
      setError(`Insufficient wallet (${walletBalance.toFixed(2)} kWh).`);
      return;
    }
    setActionLoading(true);
    setError("");
    setNewToken("");
    try {
      if (selected.architecture === "AMI") {
        const res = await applyWalletToAmi(n, selected.meter_no);
        Alert.alert("Success", res.message ?? "Units loaded to AMI meter.");
      } else {
        const res = await generateToken(n, selected.meter_no);
        setNewToken(res.token);
        Alert.alert("STS token", `Enter on CIU:\n${res.token}`);
      }
      setLoadOpen(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Load failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddMeter() {
    setFormError("");
    if (!isValidMeterNumber(formMeterNo)) {
      setFormError("Enter a meter number.");
      return;
    }
    if (formArch === "AMI" && !formToken.trim()) {
      setFormError("ThingsBoard access token is required for AMI meters.");
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        meter_no: formMeterNo.trim(),
        architecture: formArch,
        ...(formLabel.trim() ? { label: formLabel.trim() } : {}),
        ...(formArch === "AMI" ? { iot_device_token: formToken.trim() } : {}),
      };
      const res = await registerMeter(payload);
      if (res.success) {
        setAddOpen(false);
        setFormMeterNo("");
        setFormLabel("");
        setFormToken("");
        setFormArch("STS");
        load();
        Alert.alert("Meter saved", res.message ?? "Meter registered.");
      } else {
        setFormError(res.error ?? "Registration failed.");
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not register meter.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteMeter() {
    if (!selected) return;
    Alert.alert(
      "Remove meter?",
      `Meter ${selected.meter_no} will be unlinked from your account. The number can be registered again later. A record is kept for audit.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void confirmDelete(selected.meter_no),
        },
      ]
    );
  }

  async function confirmDelete(meterNo: string) {
    setActionLoading(true);
    setError("");
    try {
      const res = await deleteMeter(meterNo);
      if (res.success) {
        setSelected(null);
        await load();
        Alert.alert("Removed", res.message ?? "Meter removed from your account.");
      } else {
        setError(res.error ?? "Failed to remove meter.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to remove meter.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Screen>
        <Title>My Meters</Title>
        <Subtitle>Manage meters, check balance, and load units</Subtitle>
        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button label="Add new meter" onPress={() => setAddOpen(true)} />

        {meters.length === 0 ? (
          <Card>
            <Text style={{ color: colors.muted }}>
              No meters yet. Tap Add new meter to register an STS or AMI meter.
            </Text>
          </Card>
        ) : (
          <>
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>Your meters</Text>
            {meters.map((m) => (
              <Pressable
                key={m.meter_no}
                onPress={() => {
                  setSelected(m);
                  setLiveBalance(null);
                  setError("");
                }}
              >
                <Card>
                  <View
                    style={{
                      borderLeftWidth: selected?.meter_no === m.meter_no ? 3 : 0,
                      borderLeftColor: colors.primary,
                      paddingLeft: selected?.meter_no === m.meter_no ? 8 : 0,
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>{m.label && m.label !== "Home" ? m.label : "Home"}</Text>
                    <Text style={{ fontFamily: "SpaceMono", color: colors.muted }}>{m.meter_no}</Text>
                    <StatRow label="Type" value={m.architecture} />
                    <StatRow label="Units" value={`${Number(m.units).toFixed(2)} kWh`} />
                  </View>
                </Card>
              </Pressable>
            ))}

            {selected && (
              <Card>
                <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
                  {selected.label || "Home"} · {selected.meter_no}
                </Text>
                {selected.architecture === "STS" && (
                  <Text style={{ color: "#d97706", marginBottom: 12, fontSize: 13 }}>
                    STS meters: read remaining units from your CIU manually. Remote check is not available.
                  </Text>
                )}
                {selected.architecture === "AMI" && !selected.has_iot_token && (
                  <Text style={{ color: "#d97706", marginBottom: 12, fontSize: 13 }}>
                    ThingsBoard token not configured — add or update the device token.
                  </Text>
                )}
                {liveBalance ? <StatRow label="Live balance" value={liveBalance} /> : null}
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Button
                    label="Check Units"
                    variant="secondary"
                    onPress={handleCheckUnits}
                    loading={actionLoading}
                    disabled={selected.architecture !== "AMI" || !selected.has_iot_token}
                  />
                  <Button
                    label="Load Units"
                    onPress={() => {
                      setLoadAmount("1");
                      setNewToken("");
                      setLoadOpen(true);
                    }}
                    disabled={walletBalance <= 0}
                  />
                  <Button
                    label="Remove meter"
                    variant="secondary"
                    onPress={handleDeleteMeter}
                    loading={actionLoading}
                  />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                  Wallet: {walletBalance.toFixed(2)} kWh
                </Text>
              </Card>
            )}
          </>
        )}

        <Modal visible={addOpen} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <ScrollView style={{ maxHeight: "85%", backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
              <Title>Add new meter</Title>
              {formError ? <ErrorText>{formError}</ErrorText> : null}
              <FieldLabel>Meter type</FieldLabel>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <Button
                  label="STS"
                  variant={formArch === "STS" ? "primary" : "secondary"}
                  onPress={() => setFormArch("STS")}
                />
                <Button
                  label="AMI"
                  variant={formArch === "AMI" ? "primary" : "secondary"}
                  onPress={() => setFormArch("AMI")}
                />
              </View>
              <FieldLabel>Given name</FieldLabel>
              <Input value={formLabel} onChangeText={setFormLabel} placeholder="e.g. Home, Shop" />
              <FieldLabel>Meter number</FieldLabel>
              <Input
                value={formMeterNo}
                onChangeText={setFormMeterNo}
                maxLength={METER_NO_MAX_LENGTH}
              />
              {formArch === "AMI" && (
                <>
                  <FieldLabel>ThingsBoard access token</FieldLabel>
                  <Input value={formToken} onChangeText={setFormToken} autoCapitalize="none" />
                </>
              )}
              <Button label="Save meter" onPress={handleAddMeter} loading={formLoading} />
              <Button label="Cancel" variant="secondary" onPress={() => setAddOpen(false)} />
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={loadOpen} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
              <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 8 }}>Load units</Text>
              <Text style={{ color: colors.muted, marginBottom: 12 }}>
                {selected?.meter_no} ({selected?.architecture})
              </Text>
              <FieldLabel>kWh from wallet</FieldLabel>
              <Input value={loadAmount} onChangeText={setLoadAmount} keyboardType="decimal-pad" />
              {newToken ? (
                <Text style={{ fontFamily: "SpaceMono", marginVertical: 8 }}>{newToken}</Text>
              ) : null}
              <Button label="Confirm load" onPress={handleLoadConfirm} loading={actionLoading} />
              <Button label="Cancel" variant="secondary" onPress={() => setLoadOpen(false)} />
            </View>
          </View>
        </Modal>
      </Screen>
    </ScrollView>
  );
}
