import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  applyForLoan,
  disburseLoan,
  getMyLoans,
  repayLoan,
  repayLoanMoMo,
} from "@/lib/loan-api";
import { getLoanStats } from "@/lib/dashboard-api";
import type { LoanApplication, LoanStats } from "@/types/api";
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
} from "@/components/ui";

export default function LoansScreen() {
  const [stats, setStats] = useState<LoanStats>({
    pending_applications: 0,
    active_loans: 0,
    outstanding_balance: 0,
  });
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [amount, setAmount] = useState("50000");
  const [purpose, setPurpose] = useState("Household electricity");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayPhone, setRepayPhone] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([getLoanStats(), getMyLoans()]);
      setStats(s);
      setLoans(list);
      if (list[0]?.id) setSelectedLoanId(list[0].id);
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

  async function runAction(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;

  const approved = loans.filter((l) => l.status === "APPROVED");
  const disbursed = loans.filter((l) => ["DISBURSED", "ACTIVE", "DEFAULTED"].includes(l.status));

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Screen>
        <Title>Loans</Title>
        <Subtitle>Apply, accept, and repay micro-electricity loans</Subtitle>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {message ? <Text style={{ color: "#16a34a", marginBottom: 8 }}>{message}</Text> : null}

        <Card>
          <StatRow label="Pending" value={String(stats.pending_applications)} />
          <StatRow label="Active" value={String(stats.active_loans)} />
          <StatRow
            label="Outstanding"
            value={`UGX ${stats.outstanding_balance.toLocaleString()}`}
          />
        </Card>

        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Apply for loan</Text>
          <FieldLabel>Amount (UGX, 5k–200k)</FieldLabel>
          <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
          <FieldLabel>Purpose</FieldLabel>
          <Input value={purpose} onChangeText={setPurpose} />
          <Button
            label="Submit application"
            loading={submitting}
            onPress={() =>
              runAction(async () => {
                const res = await applyForLoan({
                  amount_requested: parseFloat(amount),
                  purpose,
                  tenure_months: 1,
                });
                setMessage(res.status ? `Application ${res.status}` : "Application submitted.");
              })
            }
          />
        </Card>

        {approved.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Accept approved loan</Text>
            {approved.map((loan) => (
              <View key={loan.id} style={{ marginBottom: 12 }}>
                <Text>#{loan.id} — UGX {loan.amount_approved ?? loan.amount_requested}</Text>
                <Button
                  label="Disburse to wallet"
                  loading={submitting}
                  onPress={() =>
                    runAction(async () => {
                      const res = await disburseLoan(loan.id);
                      setMessage(res.message ?? "Loan disbursed.");
                    })
                  }
                />
              </View>
            ))}
          </Card>
        )}

        {disbursed.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Repay loan</Text>
            <FieldLabel>Loan ID</FieldLabel>
            <Input
              value={selectedLoanId ? String(selectedLoanId) : ""}
              onChangeText={(v) => setSelectedLoanId(parseInt(v, 10) || null)}
              keyboardType="number-pad"
            />
            <FieldLabel>Amount (UGX)</FieldLabel>
            <Input value={repayAmount} onChangeText={setRepayAmount} keyboardType="number-pad" />
            <Button
              label="Repay from wallet"
              loading={submitting}
              onPress={() =>
                runAction(async () => {
                  if (!selectedLoanId) throw new Error("Select a loan ID.");
                  const res = await repayLoan(selectedLoanId, parseFloat(repayAmount));
                  setMessage(res.message ?? "Repayment recorded.");
                })
              }
            />
            <FieldLabel>MoMo phone (optional)</FieldLabel>
            <Input value={repayPhone} onChangeText={setRepayPhone} keyboardType="phone-pad" />
            <Button
              label="Repay via MTN MoMo"
              variant="secondary"
              loading={submitting}
              onPress={() =>
                runAction(async () => {
                  if (!selectedLoanId || !repayPhone.trim()) {
                    throw new Error("Loan ID and phone required for MoMo.");
                  }
                  const res = await repayLoanMoMo(selectedLoanId, repayPhone.trim());
                  setMessage(res.message ?? `MoMo initiated: ${res.external_id ?? ""}`);
                })
              }
            />
          </Card>
        )}

        {loans.length > 0 && (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Your loans</Text>
            {loans.map((loan) => (
              <Text key={loan.id} style={{ marginBottom: 6, color: "#334155" }}>
                #{loan.id} {loan.loan_id} — {loan.status} — UGX{" "}
                {loan.outstanding_balance ?? loan.amount_requested}
              </Text>
            ))}
          </Card>
        )}
      </Screen>
    </ScrollView>
  );
}
