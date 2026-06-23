import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { ApiError } from "@/lib/api";
import {
  applyWalletToAmi,
  generateToken,
} from "@/lib/meter-api";
import { getWalletBalance } from "@/lib/dashboard-api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  StatRow,
} from "@/components/ui";
import type { MeterInfo } from "@/types/api";

type Props = {
  meters: MeterInfo[];
  walletBalance: number;
  onWalletChange?: (balance: number) => void;
  onSuccess?: () => void;
};

export function LoadUnitsPanel({ meters, walletBalance, onWalletChange, onSuccess }: Props) {
  const [selectedNo, setSelectedNo] = useState(meters[0]?.meter_no ?? "");
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenResult, setTokenResult] = useState("");

  const selected = meters.find((m) => m.meter_no === selectedNo) ?? meters[0];
  const isAmi = selected?.architecture === "AMI";

  async function handleLoad() {
    setError("");
    setTokenResult("");
    const n = parseFloat(amount);
    if (!selected || !n || n <= 0) {
      setError("Select a meter and enter a valid kWh amount.");
      return;
    }
    if (n > walletBalance) {
      setError(`Insufficient wallet balance (${walletBalance.toFixed(2)} kWh).`);
      return;
    }

    Alert.alert(
      isAmi ? "Confirm AMI load" : "Confirm STS token",
      isAmi
        ? `Load ${n.toFixed(2)} kWh to ${selected.meter_no} via ThingsBoard?`
        : `Generate STS token for ${n.toFixed(2)} kWh on meter ${selected.meter_no}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => void executeLoad(n),
        },
      ]
    );
  }

  async function executeLoad(n: number) {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      if (isAmi) {
        const res = await applyWalletToAmi(n, selected.meter_no);
        Alert.alert("Load complete", res.message ?? "Units sent to AMI meter.");
      } else {
        const res = await generateToken(n, selected.meter_no);
        setTokenResult(res.token);
        Alert.alert("Token generated", `Enter on CIU:\n${res.token}`);
        if (res.remaining_balance != null) {
          onWalletChange?.(res.remaining_balance);
        }
      }
      const w = await getWalletBalance();
      onWalletChange?.(w.balance ?? 0);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!meters.length) {
    return (
      <Text style={{ color: "#64748b" }}>
        Register a meter under the Meters tab first.
      </Text>
    );
  }

  return (
    <View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Card>
        <StatRow label="Wallet balance" value={`${walletBalance.toFixed(2)} kWh`} />
      </Card>
      <Card>
        <FieldLabel>Select meter</FieldLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {meters.map((m) => (
            <Button
              key={m.meter_no}
              label={`${m.label && m.label !== "Home" ? m.label : m.meter_no} (${m.architecture})`}
              variant={selectedNo === m.meter_no ? "primary" : "secondary"}
              onPress={() => setSelectedNo(m.meter_no)}
            />
          ))}
        </View>
        <FieldLabel>kWh to load</FieldLabel>
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Button
          label={isAmi ? "Load to meter" : "Generate token"}
          onPress={handleLoad}
          loading={loading}
          disabled={walletBalance <= 0}
        />
        {tokenResult ? (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: "#f0f9ff", borderRadius: 8 }}>
            <Text style={{ fontWeight: "600" }}>STS token</Text>
            <Text style={{ fontFamily: "SpaceMono", fontSize: 18, marginTop: 4 }}>{tokenResult}</Text>
          </View>
        ) : null}
        {isAmi ? (
          <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Units are pushed to your device via ThingsBoard.
          </Text>
        ) : (
          <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Enter the token on your meter keypad (CIU).
          </Text>
        )}
      </Card>
    </View>
  );
}
