import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  applyForLoan,
  getMyLoans,
  repayActiveLoan,
  repayActiveLoanMoMo,
} from "@/lib/loan-api";
import { getLoanStats } from "@/lib/dashboard-api";
import type { LoanApplication, LoanStats } from "@/types/api";
import { PIN_LENGTH, PinField } from "@/components/pin-field";
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
const LOAN_TENURE_MIN = 1;
const LOAN_TENURE_MAX = 12;
const LOAN_MONTH_DAYS = 30;

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
  const [tenure, setTenure] = useState("1");
  const [purpose, setPurpose] = useState("Household electricity");
  const [applyPin, setApplyPin] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayPhone, setRepayPhone] = useState("");
  const [repayMode, setRepayMode] = useState<"full" | "partial" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([getLoanStats(), getMyLoans()]);
      setStats(s);
      setLoans(list);
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

  const repayableLoan =
    stats.repayable_loan ??
    (() => {
      const active = loans.find(
        (l) =>
          l.status === "DISBURSED" && Number(l.outstanding_balance ?? 0) > 0
      );
      return active
        ? {
            id: active.id,
            loan_id: active.loan_id,
            outstanding_balance: Number(active.outstanding_balance ?? 0),
          }
        : null;
    })();
  const repayOutstanding = repayableLoan?.outstanding_balance ?? 0;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Screen>
        <Title>Loans</Title>
        <Subtitle>Apply and repay micro-electricity loans</Subtitle>
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
              Borrowing is limited (score {creditScore}/{minCredit}). Repay any overdue loan to restore
              your starter limit of {formatUGX(stats.starter_max_loan ?? 30_000)}.
            </Text>
          </Card>
        ) : null}

        {!blocking && isEligible ? (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Apply for loan</Text>
            {(stats.trust_level === "starter" || !stats.trust_level) && (
              <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                Starter access: up to {formatUGX(stats.starter_max_loan ?? 30_000)}. Repay on time to
                unlock higher limits.
              </Text>
            )}
            <FieldLabel>Amount ({amountHint})</FieldLabel>
            <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            <FieldLabel>Tenure (months)</FieldLabel>
            <Input value={tenure} onChangeText={setTenure} keyboardType="number-pad" />
            <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>
              {LOAN_TENURE_MIN}–{LOAN_TENURE_MAX} months. Each month = {LOAN_MONTH_DAYS} days from disbursement.
            </Text>
            <FieldLabel>Purpose</FieldLabel>
            <Input value={purpose} onChangeText={setPurpose} />
            <PinField value={applyPin} onChangeText={setApplyPin} editable={!submitting} />
            <Button
              label="Submit application"
              loading={submitting}
              onPress={() =>
                runAction(async () => {
                  const value = parseFloat(amount);
                  const tenureMonths = parseInt(tenure, 10);
                  if (!value || value < minLoan) {
                    throw new Error(`Minimum loan amount is ${formatUGX(minLoan)}.`);
                  }
                  if (value > amountCap) {
                    throw new Error(`Maximum for you is ${formatUGX(amountCap)}.`);
                  }
                  if (
                    !tenureMonths ||
                    tenureMonths < LOAN_TENURE_MIN ||
                    tenureMonths > LOAN_TENURE_MAX
                  ) {
                    throw new Error(
                      `Tenure must be ${LOAN_TENURE_MIN}–${LOAN_TENURE_MAX} months.`
                    );
                  }
                  if (applyPin.length !== PIN_LENGTH) {
                    throw new Error("Enter your 4-digit transaction PIN to confirm.");
                  }
                  const res = await applyForLoan({
                    amount_requested: value,
                    purpose,
                    tenure_months: tenureMonths,
                    pin: applyPin,
                  });
                  if (res.rejection_reason) {
                    throw new Error(res.rejection_reason);
                  }
                  if (res.status === "REJECTED") {
                    throw new Error(res.message ?? "Application was rejected.");
                  }
                  setApplyPin("");
                  setMessage(
                    res.message ??
                      (res.status
                        ? `Application ${res.status}${res.loan_id ? ` (#${res.loan_id})` : ""}`
                        : "Application submitted.")
                  );
                })
              }
            />
          </Card>
        ) : null}

        {repayableLoan && repayOutstanding > 0 && (
          <Card>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Repay loan</Text>
            <StatRow label="Reference" value={repayableLoan.loan_id} />
            <StatRow
              label="Outstanding"
              value={formatUGX(repayOutstanding)}
            />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Pay full"
                  variant={repayMode === "full" ? "primary" : "secondary"}
                  onPress={() => {
                    setRepayMode("full");
                    setRepayAmount(String(Math.round(repayOutstanding)));
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Pay partial"
                  variant={repayMode === "partial" ? "primary" : "secondary"}
                  onPress={() => {
                    setRepayMode("partial");
                    setRepayAmount("");
                  }}
                />
              </View>
            </View>
            {repayMode === "partial" ? (
              <>
                <FieldLabel>Amount (UGX)</FieldLabel>
                <Input
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
            <Button
              label="Repay from wallet"
              loading={submitting}
              disabled={!repayMode}
              onPress={() =>
                runAction(async () => {
                  const repayValue =
                    repayMode === "full"
                      ? repayOutstanding
                      : parseFloat(repayAmount);
                  if (!repayValue || repayValue <= 0) {
                    throw new Error("Enter a valid repayment amount.");
                  }
                  if (repayValue > repayOutstanding) {
                    throw new Error(
                      `Maximum repayment is ${formatUGX(repayOutstanding)}.`
                    );
                  }
                  const res = await repayActiveLoan(repayValue);
                  setMessage(res.message ?? "Repayment recorded.");
                  setRepayMode(null);
                  setRepayAmount("");
                })
              }
            />
            <FieldLabel>MTN MoMo number</FieldLabel>
            <Input value={repayPhone} onChangeText={setRepayPhone} keyboardType="phone-pad" />
            <Button
              label="Repay via MTN MoMo"
              variant="secondary"
              loading={submitting}
              disabled={!repayMode}
              onPress={() =>
                runAction(async () => {
                  if (!repayPhone.trim()) {
                    throw new Error("Enter your MoMo number.");
                  }
                  const repayValue =
                    repayMode === "full"
                      ? repayOutstanding
                      : parseFloat(repayAmount);
                  if (!repayValue || repayValue <= 0) {
                    throw new Error("Enter a valid repayment amount.");
                  }
                  if (repayValue > repayOutstanding) {
                    throw new Error(
                      `Maximum repayment is ${formatUGX(repayOutstanding)}.`
                    );
                  }
                  const phone = repayPhone.startsWith("+")
                    ? repayPhone.trim()
                    : `+256${repayPhone.trim().replace(/^0/, "")}`;
                  const res = await repayActiveLoanMoMo(phone, repayValue);
                  setMessage(res.message ?? `MoMo initiated: ${res.external_id ?? ""}`);
                  setRepayMode(null);
                  setRepayAmount("");
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
