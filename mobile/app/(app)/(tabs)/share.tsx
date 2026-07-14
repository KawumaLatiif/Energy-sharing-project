import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError } from "@/lib/api";
import { getWalletBalance } from "@/lib/dashboard-api";
import { getMyMeters } from "@/lib/meter-api";
import { confirmShare, getShareReceiverPreview } from "@/lib/share-api";
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
import type { ShareRecipientPreview } from "@/lib/share-api";
import { PIN_LENGTH, PinField } from "@/components/pin-field";

type Mode = "choose" | "load" | "share";

export default function LoadShareScreen() {
  const [mode, setMode] = useState<Mode>("choose");
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [meterNumber, setMeterNumber] = useState("");
  const [units, setUnits] = useState("2");
  const [pin, setPin] = useState("");
  const [shareStep, setShareStep] = useState<"form" | "confirm">("form");
  const [recipient, setRecipient] = useState<ShareRecipientPreview | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("");
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

  function resetShare() {
    setShareStep("form");
    setMeterNumber("");
    setUnits("2");
    setPin("");
    setRecipient(null);
    setDeliveryMethod("");
    setError("");
  }

  async function handleContinueToConfirm() {
    setError("");
    setSuccess("");
    const n = parseFloat(units);
    if (!meterNumber.trim() || !n || n < 2) {
      setError("Enter receiver meter and at least 2 kWh.");
      return;
    }
    if (n > walletBalance) {
      setError(`Insufficient balance. You have ${walletBalance.toFixed(2)} kWh.`);
      return;
    }
    setSubmitting(true);
    try {
      const preview = await getShareReceiverPreview(meterNumber.trim());
      if (!preview.success || !preview.recipient) {
        setError(preview.error ?? "Receiver meter not found.");
        return;
      }
      setRecipient(preview.recipient);
      setDeliveryMethod(preview.delivery_method ?? "");
      setShareStep("confirm");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify receiver.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmShare() {
    setError("");
    setSuccess("");
    const n = parseFloat(units);
    if (pin.length !== PIN_LENGTH) {
      setError("Enter your 4-digit transaction PIN.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await confirmShare(meterNumber.trim(), n, pin);
      if (!res.success) {
        setError(res.error ?? res.message ?? "Share failed.");
        return;
      }
      setSuccess(
        res.message ??
          (res.share_token
            ? `Share complete. Token: ${res.share_token}`
            : `Shared ${res.units_shared} kWh to ${res.receiver_name ?? recipient?.name}.`)
      );
      resetShare();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Share failed.");
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
          <Button label="← Back" variant="secondary" onPress={() => { setMode("choose"); resetShare(); }} />
          <Title>Share Units</Title>
          <Subtitle>Send kWh to another customer&apos;s meter</Subtitle>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {success ? <Text style={{ color: colors.success, marginBottom: 8 }}>{success}</Text> : null}
          <Card>
            <StatRow label="Wallet balance" value={`${walletBalance.toFixed(2)} kWh`} />
          </Card>
          {shareStep === "form" ? (
            <Card>
              <FieldLabel>Receiver meter number</FieldLabel>
              <Input value={meterNumber} onChangeText={setMeterNumber} />
              <FieldLabel>Units to share (min 2)</FieldLabel>
              <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
              <Button label="Continue" onPress={handleContinueToConfirm} loading={submitting} />
            </Card>
          ) : recipient ? (
            <Card>
              <Text style={{ fontWeight: "700", marginBottom: 8 }}>Confirm share</Text>
              <StatRow label="Recipient" value={recipient.name} />
              <StatRow label="Meter" value={recipient.meter_number} />
              <StatRow label="Type" value={recipient.meter_type_label} />
              <StatRow label="Units" value={`${parseFloat(units).toFixed(2)} kWh`} />
              {deliveryMethod ? (
                <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 8 }}>{deliveryMethod}</Text>
              ) : null}
              <PinField value={pin} onChangeText={setPin} />
              <Button label="Confirm share" onPress={handleConfirmShare} loading={submitting} />
              <Button label="Back" variant="secondary" onPress={() => { setShareStep("form"); setPin(""); setError(""); }} />
            </Card>
          ) : null}
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
              Enter recipient meter, units, then confirm with your transaction PIN.
            </Text>
            <Button label="Share to another meter" variant="secondary" onPress={() => setMode("share")} />
          </Card>
        </View>
      </Screen>
    </ScrollView>
  );
}
