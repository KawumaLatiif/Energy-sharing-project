import { useCallback, useMemo, useState } from "react";
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

const DEFAULT_PLATFORM_MAX = 200_000;
const DEFAULT_MIN_LOAN = 5_000;
const DEFAULT_MIN_CREDIT = 75;

function formatUGX(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

function hasBlockingLoan(stats: LoanStats): boolean {
  return (
    stats.has_blocking_loan ??
    (stats.pending_applications > 0 ||
      stats.active_loans > 0 ||
      Number(stats.outstanding_balance ?? 0) > 0)
  );
}

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

  const blocking = hasBlockingLoan(stats);
  const isEligible = Boolean(stats.is_loan_eligible);
  const platformMax = stats.platform_max_loan ?? DEFAULT_PLATFORM_MAX;
  const minLoan = stats.min_loan_amount ?? DEFAULT_MIN_LOAN;
  const minCredit = stats.min_credit_score ?? DEFAULT_MIN_CREDIT;
  const creditScore = Number(stats.credit_score ?? 0);
  const maxEligible = Number(stats.max_eligible_amount ?? 0);
  const amountCap = isEligible ? Math.min(maxEligible, platformMax) : platformMax;

  const amountHint = useMemo(() => {
    if (!isEligible) {
      return `Platform max ${formatUGX(platformMax)} (eligibility required)`;
    }
    if (maxEligible < platformMax) {
      return `${formatUGX(minLoan)} – ${formatUGX(amountCap)} (your eligible limit)`;
    }
    return `${formatUGX(minLoan)} – ${formatUGX(amountCap)}`;
  }, [isEligible, maxEligible, platformMax, minLoan, amountCap]);

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
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Your eligibility</Text>
          <StatRow label="Credit score" value={`${creditScore}/100`} />
          <StatRow label="Minimum required" value={`${minCredit}/100`} />
          {stats.loan_tier ? <StatRow label="Loan tier" value={stats.loan_tier} /> : null}
          <StatRow
            label="Your eligible limit"
            value={isEligible ? formatUGX(maxEligible) : "Not eligible"}
          />
          <StatRow label="Platform maximum" value={formatUGX(platformMax)} />
          {stats.interest_rate != null ? (
            <StatRow label="Interest rate" value={`${stats.interest_rate}% p.a.`} />
          ) : null}
        </Card>

        {blocking ? (
          <Card>
            <Text style={{ color: "#b45309", lineHeight: 20 }}>
              You already have a pending or active loan. Clear it before applying for another.
            </Text>
          </Card>
        ) : null}

        {!blocking && !isEligible ? (
          <Card>
            <Text style={{ color: "#b45309", lineHeight: 20, marginBottom: 8 }}>
              Your credit score is below {minCredit}.{" "}
              {!stats.profile_complete_for_scoring
                ? "Complete your profile (payment history, consumption, etc.) on the web dashboard to improve your score."
                : "Improve your payment history and profile to become eligible."}
            </Text>
          </Card>
        ) : null}

        {!blocking && isEligible ? (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Apply for loan</Text>
            <FieldLabel>Amount ({amountHint})</FieldLabel>
            <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            <FieldLabel>Purpose</FieldLabel>
            <Input value={purpose} onChangeText={setPurpose} />
            <Button
              label="Submit application"
              loading={submitting}
              onPress={() =>
                runAction(async () => {
                  const value = parseFloat(amount);
                  if (!value || value < minLoan) {
                    throw new Error(`Minimum loan amount is ${formatUGX(minLoan)}.`);
                  }
                  if (value > amountCap) {
                    throw new Error(`Maximum for you is ${formatUGX(amountCap)}.`);
                  }
                  const res = await applyForLoan({
                    amount_requested: value,
                    purpose,
                    tenure_months: 1,
                  });
                  if (res.rejection_reason) {
                    throw new Error(res.rejection_reason);
                  }
                  if (res.status === "REJECTED") {
                    throw new Error(res.message ?? "Application was rejected.");
                  }
                  setMessage(
                    res.status
                      ? `Application ${res.status}${res.loan_id ? ` (#${res.loan_id})` : ""}`
                      : "Application submitted."
                  );
                })
              }
            />
          </Card>
        ) : null}

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
                  const repayValue = parseFloat(repayAmount);
                  if (!repayValue || repayValue <= 0) {
                    throw new Error("Enter a valid repayment amount.");
                  }
                  const res = await repayLoan(selectedLoanId, repayValue);
                  setMessage(res.message ?? "Repayment recorded.");
                })
              }
            />
            <FieldLabel>MTN MoMo number</FieldLabel>
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
                  const repayValue = parseFloat(repayAmount);
                  if (!repayValue || repayValue <= 0) {
                    throw new Error("Enter a repayment amount for MoMo.");
                  }
                  const phone = repayPhone.startsWith("+")
                    ? repayPhone.trim()
                    : `+256${repayPhone.trim().replace(/^0/, "")}`;
                  const res = await repayLoanMoMo(selectedLoanId, phone, repayValue);
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
