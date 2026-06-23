import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError } from "@/lib/api";
import { getWalletBalance } from "@/lib/dashboard-api";
import { getMyMeters } from "@/lib/meter-api";
import { getShareReceiverPreview, initiateShare, verifyShare } from "@/lib/share-api";
import { LoadUnitsPanel } from "@/components/load-units-panel";
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

type Mode = "choose" | "load" | "share";

export default function LoadShareScreen() {
  const [mode, setMode] = useState<Mode>("choose");
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [meterNumber, setMeterNumber] = useState("");
  const [units, setUnits] = useState("2");
  const [otp, setOtp] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [shareStep, setShareStep] = useState<"init" | "verify">("init");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([getMyMeters(), getWalletBalance()]);
      setMeters(m);
      setWalletBalance(w.balance ?? 0);
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

  async function handleInitiateShare() {
    setError("");
    setSuccess("");
    const n = parseFloat(units);
    if (!meterNumber.trim() || !n || n < 2) {
      setError("Enter receiver meter and at least 2 kWh.");
      return;
    }
    setSubmitting(true);
    try {
      const preview = await getShareReceiverPreview(meterNumber.trim());
      if (!preview.success || !preview.recipient) {
        setError(preview.error ?? "Receiver meter not found.");
        return;
      }
      const r = preview.recipient;
      Alert.alert(
        "Confirm share",
        [
          `Name: ${r.name}`,
          `Meter: ${r.meter_number}`,
          `Type: ${r.meter_type_label}`,
          `Phone: ${r.phone_number}`,
          `Units: ${n} kWh`,
          "",
          preview.delivery_method ?? "",
        ].join("\n"),
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: () => void sendVerificationCode(n) },
        ]
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify receiver.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendVerificationCode(n: number) {
    setSubmitting(true);
    setError("");
    try {
      const res = await initiateShare(meterNumber.trim(), n);
      setTransactionRef(res.transaction_ref ?? "");
      setShareStep("verify");
      setSuccess(res.message ?? "Check your email for the verification code.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Share failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyShare() {
    setError("");
    setSuccess("");
    if (!otp.trim() || !transactionRef) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyShare(otp.trim(), transactionRef);
      setSuccess(
        res.message ?? (res.token ? `Share complete. Token: ${res.token}` : "Share completed.")
      );
      setShareStep("init");
      setOtp("");
      setMeterNumber("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (mode === "load") {
    return (
      <ScrollView>
        <Screen>
          <Button label="← Back" variant="secondary" onPress={() => setMode("choose")} />
          <Title>Load Units</Title>
          <Subtitle>Load wallet kWh onto your own meter</Subtitle>
          <LoadUnitsPanel
            meters={meters}
            walletBalance={walletBalance}
            onWalletChange={setWalletBalance}
            onSuccess={load}
          />
        </Screen>
      </ScrollView>
    );
  }

  if (mode === "share") {
    return (
      <ScrollView>
        <Screen>
          <Button label="← Back" variant="secondary" onPress={() => setMode("choose")} />
          <Title>Share Units</Title>
          <Subtitle>Send kWh to another customer&apos;s meter</Subtitle>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {success ? <Text style={{ color: colors.success, marginBottom: 8 }}>{success}</Text> : null}
          <Card>
            <StatRow label="Wallet balance" value={`${walletBalance.toFixed(2)} kWh`} />
          </Card>
          {shareStep === "init" ? (
            <Card>
              <FieldLabel>Receiver meter number</FieldLabel>
              <Input value={meterNumber} onChangeText={setMeterNumber} keyboardType="number-pad" />
              <FieldLabel>Units to share (min 2)</FieldLabel>
              <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
              <Button label="Send verification code" onPress={handleInitiateShare} loading={submitting} />
            </Card>
          ) : (
            <Card>
              <Text style={{ color: colors.muted, marginBottom: 12 }}>Ref: {transactionRef}</Text>
              <FieldLabel>Email verification code</FieldLabel>
              <Input value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
              <Button label="Confirm share" onPress={handleVerifyShare} loading={submitting} />
              <Button
                label="Start over"
                variant="secondary"
                onPress={() => {
                  setShareStep("init");
                  setOtp("");
                  setError("");
                }}
              />
            </Card>
          )}
        </Screen>
      </ScrollView>
    );
  }

  return (
    <ScrollView>
      <Screen>
        <Title>Load / Share Units</Title>
        <Subtitle>Load onto your meters or share with others</Subtitle>
        <Card>
          <StatRow label="Wallet balance" value={`${walletBalance.toFixed(2)} kWh`} />
        </Card>
        <View style={{ gap: 12 }}>
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 4 }}>Load Units</Text>
            <Text style={{ color: colors.muted, marginBottom: 12, fontSize: 13 }}>
              AMI → direct device top-up. STS → keypad token for your CIU.
            </Text>
            <Button
              label="Load to my meter"
              onPress={() => setMode("load")}
              disabled={!meters.length}
            />
          </Card>
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 4 }}>Share Units</Text>
            <Text style={{ color: colors.muted, marginBottom: 12, fontSize: 13 }}>
              Send kWh to another meter. STS receivers get a token; AMI receivers get direct top-up.
            </Text>
            <Button label="Share to another meter" variant="secondary" onPress={() => setMode("share")} />
          </Card>
        </View>
      </Screen>
    </ScrollView>
  );
}
