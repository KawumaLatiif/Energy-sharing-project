import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  buyUnits,
  checkPaymentStatus,
  estimateUnits,
} from "@/lib/meter-api";
import { ApiError } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import type { UnitEstimate } from "@/types/api";

function formatUGX(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

export default function BuyUnitsScreen() {
  const [amount, setAmount] = useState("5000");
  const [phone, setPhone] = useState("");
  const [estimate, setEstimate] = useState<UnitEstimate | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEstimate = useCallback(async (value: number) => {
    if (value < 100) {
      setEstimate(null);
      return;
    }
    try {
      const data = await estimateUnits(value);
      setEstimate(data);
    } catch {
      setEstimate(null);
    }
  }, []);

  useEffect(() => {
    const n = parseInt(amount, 10);
    if (!n || n < 100) return;
    const t = setTimeout(() => fetchEstimate(n), 400);
    return () => clearTimeout(t);
  }, [amount, fetchEstimate]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleBuy() {
    setError("");
    setStatus("");
    const n = parseInt(amount, 10);
    if (!n || n < 100) {
      setError("Enter at least UGX 100.");
      return;
    }
    if (!phone) {
      setError("Enter your MTN Mobile Money number.");
      return;
    }

    setLoading(true);
    try {
      const res = await buyUnits(n, phone.startsWith("+") ? phone : `+256${phone.replace(/^0/, "")}`);
      if (res.status === "PENDING" && res.transaction_id) {
        setStatus("Approve the payment on your phone…");
        setPolling(true);
        const txId = String(res.transaction_id);
        pollRef.current = setInterval(async () => {
          try {
            const check = await checkPaymentStatus(txId);
            if (check.status === "SUCCESS") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              setStatus(
                `Payment successful! ${check.units_purchased ?? ""} kWh credited.${
                  check.token ? ` Token: ${check.token}` : ""
                }`
              );
            } else if (check.status === "FAILED") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              setError(check.message || "Payment failed.");
            }
          } catch {
            /* keep polling */
          }
        }, 4000);
      } else {
        setStatus(res.message || "Purchase initiated.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Screen>
        <Title>TopUp Wallet</Title>
        <Subtitle>Pay with MTN Mobile Money (ERA tariff)</Subtitle>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {status ? (
          <Text style={{ color: "#16a34a", marginBottom: 12 }}>{status}</Text>
        ) : null}

        <FieldLabel>Amount (UGX)</FieldLabel>
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="5000"
        />

        {estimate && (
          <Card>
            <StatEstimate label="You get" value={`${estimate.estimated_units} kWh`} />
            {estimate.service_charge != null && estimate.service_charge > 0 && (
              <StatEstimate
                label="Service charge"
                value={formatUGX(estimate.service_charge)}
              />
            )}
            {estimate.vat != null && (
              <StatEstimate label="VAT (18%)" value={formatUGX(estimate.vat)} />
            )}
            {estimate.insufficient_amount && estimate.minimum_payment != null && (
              <Text style={{ color: "#b45309", marginTop: 8, fontSize: 13 }}>
                Minimum for any units this month: {formatUGX(estimate.minimum_payment)}
              </Text>
            )}
          </Card>
        )}

        <FieldLabel>MTN Mobile Money number</FieldLabel>
        <Input
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+2567XXXXXXXX"
        />

        <Button
          label={polling ? "Waiting for payment…" : "Review & Pay"}
          onPress={handleBuy}
          loading={loading || polling}
        />
      </Screen>
    </ScrollView>
  );
}

function StatEstimate({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: "#64748b" }}>{label}</Text>
      <Text style={{ fontWeight: "600" }}>{value}</Text>
    </View>
  );
}
