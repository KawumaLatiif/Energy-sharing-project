"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StepWizard } from "@/components/ui/step-wizard";
import { SegmentedSelector } from "@/components/ui/segmented-selector";
import { BreakdownCard } from "@/components/ui/breakdown-card";
import { InfoBanner } from "@/components/ui/info-banner";
import { FormError } from "@/components/common/form-error";
import { get } from "@/lib/fetch";
import { submitLoanApplication } from "../action";
import { getApiErrorMessage } from "@/lib/api-response";

const STEPS = [
  { label: "Amount" },
  { label: "Purpose" },
  { label: "T&C" },
  { label: "Submit" },
];

const PURPOSE_OPTIONS = [
  { label: "Energy Recharge", value: "ENERGY_RECHARGE" },
  { label: "Electricity Utility Arrears", value: "UEDCL_ARREARS" },
  { label: "Business", value: "BUSINESS" },
  { label: "Personal", value: "PERSONAL" },
];

// Statutory compliant rates (Uganda Tier 4 MFI Act: ≤2.8%/month = ≤33.6%/year)
// These are annual rates stored in the backend; the backend enforces the cap.
const PROCESSING_FEE_PCT = 0.02;   // 2% of principal

function formatUGX(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

interface LoanBreakdown {
  principal: number;
  interestRate: number;   // annual %, from backend
  tenureMonths: number;
  interest: number;
  processingFee: number;
  total: number;
  dueDate: string;
}

function computeBreakdown(amount: number, tenure: number, annualRate: number): LoanBreakdown {
  const interest = amount * (annualRate / 100) * (tenure / 12);
  const processingFee = amount * PROCESSING_FEE_PCT;
  const total = amount + interest + processingFee;
  const due = new Date();
  due.setMonth(due.getMonth() + tenure);
  return {
    principal: amount,
    interestRate: annualRate,
    tenureMonths: tenure,
    interest,
    processingFee,
    total,
    dueDate: due.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }),
  };
}

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SimpleLoanForm({ onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Form state
  const [amount, setAmount] = useState<number | "">("");
  const [tenure, setTenure] = useState(1);
  const [purpose, setPurpose] = useState("ENERGY_RECHARGE");
  const [purposeNote, setPurposeNote] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [annualRate, setAnnualRate] = useState(12); // fetched from backend tier

  // Fetch active loan status and current tier rate
  useEffect(() => {
    (async () => {
      try {
        const res = await get<any>("loans/my-loans/");
        if (res.data) {
          const active = res.data.filter((l: any) =>
            ["PENDING", "APPROVED", "DISBURSED"].includes(l.status)
          );
          setHasActiveLoan(active.length > 0);
        }
        // Fetch stats which include tier/rate info
        const statsRes = await get<any>("loans/stats/");
        if (statsRes.data?.interest_rate) {
          setAnnualRate(statsRes.data.interest_rate);
        }
      } catch {
        /* ignore */
      } finally {
        setIsChecking(false);
      }
    })();
  }, []);

  const breakdown = amount
    ? computeBreakdown(Number(amount), tenure, annualRate)
    : null;

  const monthlyRate = (annualRate / 12).toFixed(2);

  // ── Step validation ───────────────────────────────────────────────
  const canProceed = useCallback(() => {
    if (step === 0) return Number(amount) >= 5000 && Number(amount) <= 200000 && tenure >= 1 && tenure <= 12;
    if (step === 1) return !!purpose;
    if (step === 2) return termsAccepted;
    return true;
  }, [step, amount, tenure, purpose, termsAccepted]);

  const handleNext = () => {
    setError("");
    if (!canProceed()) {
      if (step === 0) setError("Enter an amount between UGX 5,000 and 200,000 and a tenure of 1–12 months.");
      if (step === 2) setError("You must accept the terms to continue.");
      return;
    }
    setStep((s) => s + 1);
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!termsAccepted) { setError("Accept the terms first."); return; }
    setIsPending(true);
    setError("");
    try {
      const purposeText = PURPOSE_OPTIONS.find(o => o.value === purpose)?.label ?? purpose;
      const result = await submitLoanApplication({
        purpose: purposeNote ? `${purposeText}: ${purposeNote}` : purposeText,
        amount_requested: Number(amount),
        tenure_months: tenure,
      });
      if (result.data) {
        if (onSuccess) { onSuccess(); }
        else { router.push("/dashboard/myloans"); }
      } else if (result.error) {
        setError(getApiErrorMessage(result.error, "Failed to submit application"));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground text-sm">Checking your loan status…</span>
      </div>
    );
  }

  if (hasActiveLoan) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Loan</AlertTitle>
          <AlertDescription>You have an active loan. Repay it before applying for a new one.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/dashboard/myloans")} className="w-full">View My Loans</Button>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <StepWizard steps={STEPS} currentStep={step} />

      {/* ── Step 0: Amount ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">How much do you need?</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Your current limit is UGX 200,000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (UGX)</Label>
            <Input
              id="amount"
              type="number"
              min={5000}
              max={200000}
              placeholder="e.g. 50,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">Min: UGX 5,000 · Max: UGX 200,000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenure">Repayment Period (months)</Label>
            <Input
              id="tenure"
              type="number"
              min={1}
              max={12}
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value) || 1)}
            />
          </div>

          {breakdown && (
            <BreakdownCard
              rows={[
                { label: "Principal", value: formatUGX(breakdown.principal) },
                { label: `Interest (${monthlyRate}%/month)`, value: formatUGX(breakdown.interest) },
                { label: `Processing Fee (${(PROCESSING_FEE_PCT * 100).toFixed(0)}%)`, value: formatUGX(breakdown.processingFee) },
                { label: "Due Date", value: breakdown.dueDate, muted: true },
              ]}
              totalLabel="Total Repayment"
              totalValue={formatUGX(breakdown.total)}
            />
          )}

          <InfoBanner>
            Interest rate: {monthlyRate}% per month ({annualRate}% per annum) — within Uganda&apos;s statutory cap of 2.8%/month.
          </InfoBanner>
        </div>
      )}

      {/* ── Step 1: Purpose ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Loan Purpose</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Select the primary reason for this loan.</p>
          </div>

          <SegmentedSelector
            options={PURPOSE_OPTIONS}
            value={purpose}
            onChange={setPurpose}
          />

          <div className="space-y-2">
            <Label htmlFor="purposeNote">Additional details (optional)</Label>
            <Input
              id="purposeNote"
              placeholder="e.g. Paying for monthly electricity bill"
              value={purposeNote}
              onChange={(e) => setPurposeNote(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Terms ── */}
      {step === 2 && breakdown && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Terms & Conditions</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Review the loan policy before accepting.</p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2 text-sm text-muted-foreground bg-muted/30">
            <p>1. <strong>Interest:</strong> {monthlyRate}% per month ({annualRate}% per annum) on the principal sum, applied pro-rata over {tenure} month{tenure > 1 ? "s" : ""}.</p>
            <p>2. <strong>Fees:</strong> {(PROCESSING_FEE_PCT * 100).toFixed(0)}% processing fee on principal, charged once at disbursement.</p>
            <p>3. <strong>Arrears:</strong> Electricity Utility arrears are prioritised during disbursement (if purpose selected).</p>
            <p>4. <strong>Late payments:</strong> A 0.1% per day penalty applies on overdue principal. Total charges (interest + penalties + fees) will never exceed 100% of the principal — as required by Uganda&apos;s Tier 4 Microfinance Institutions Act.</p>
            <p>5. <strong>Data:</strong> Your repayment history may be shared with licensed Credit Reference Bureaus (gnuGrid, Metropol, Creditinfo, Armada) in future.</p>
          </div>

          <BreakdownCard
            rows={[
              { label: "Principal", value: formatUGX(breakdown.principal) },
              { label: `Interest (${monthlyRate}%/month × ${tenure} mo)`, value: formatUGX(breakdown.interest) },
              { label: `Processing Fee (${(PROCESSING_FEE_PCT * 100).toFixed(0)}%)`, value: formatUGX(breakdown.processingFee) },
              { label: "Due Date", value: breakdown.dueDate, muted: true },
            ]}
            totalLabel="Total Repayment"
            totalValue={formatUGX(breakdown.total)}
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 accent-primary w-4 h-4"
            />
            <span className="text-sm">I accept the legally binding loan terms above.</span>
          </label>
        </div>
      )}

      {/* ── Step 3: Confirm & Submit ── */}
      {step === 3 && breakdown && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Confirm Application</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Review your application before submitting.</p>
          </div>

          <BreakdownCard
            rows={[
              { label: "Loan Amount", value: formatUGX(breakdown.principal) },
              { label: "Purpose", value: PURPOSE_OPTIONS.find(o => o.value === purpose)?.label ?? purpose },
              { label: "Tenure", value: `${tenure} month${tenure > 1 ? "s" : ""}` },
              { label: `Interest (${monthlyRate}%/month)`, value: formatUGX(breakdown.interest) },
              { label: "Processing Fee", value: formatUGX(breakdown.processingFee) },
              { label: "Due Date", value: breakdown.dueDate, muted: true },
            ]}
            totalLabel="Total Repayment"
            totalValue={formatUGX(breakdown.total)}
          />

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting your application…
            </div>
          )}
        </div>
      )}

      <FormError message={error} />

      {/* ── Navigation ── */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => { setError(""); setStep(s => s - 1); }} disabled={isPending} className="flex-1">
            Back
          </Button>
        )}
        {onCancel && step === 0 && (
          <Button variant="outline" onClick={onCancel} disabled={isPending} className="flex-1">
            Cancel
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} className="flex-1 gpawa-gradient text-white">
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isPending || !termsAccepted}
            className="flex-1 gpawa-gradient text-white font-semibold"
          >
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit Application"}
          </Button>
        )}
      </div>
    </div>
  );
}
