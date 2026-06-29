"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  AlertCircleIcon,
  WalletIcon,
} from "lucide-react";
import { get } from "@/lib/fetch-client";
import { useEffect, useState } from "react";
import { useSelectedMeter } from "@/contexts/selected-meter-context";

interface LoanStats {
  active_loans: number;
  pending_applications: number;
  approved_loans: number;
  total_repayments: number;
  total_borrowed: number;
  outstanding_balance: number;
  total_loans: number;
}

export default function LoanOverview() {
  const { walletBalance: walletUnitsBalance } = useSelectedMeter();
  const [stats, setStats] = useState<LoanStats>({
    active_loans: 0,
    pending_applications: 0,
    approved_loans: 0,
    total_repayments: 0,
    total_borrowed: 0,
    outstanding_balance: 0,
    total_loans: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLoanStats() {
      try {
        const response = await get<any>("loans/stats/");

        if (!response.error && response.data) {
          setStats(response.data);
        } else if (response.error) {
          console.warn("Failed to fetch loan stats:", response.error);
        }
      } catch (error) {
        console.error("Error fetching loan stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLoanStats();
  }, []);

  // Format currency values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cardLinkClass =
    "block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const clickableCardClass =
    "h-full shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:shadow-black/20 dark:hover:shadow-black/30";

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Active Loans */}
      <Link
        href="/dashboard/myloans"
        className={cardLinkClass}
        aria-label="View active loans"
      >
        <Card className={`border-blue-200/60 bg-gradient-to-br from-blue-50/70 to-white dark:border-blue-400/25 dark:from-blue-950/45 dark:via-slate-900 dark:to-slate-950 ${clickableCardClass}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Active Loans</CardDescription>
              <ClockIcon className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-3xl">{stats.active_loans}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Currently active electricity loans
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Wallet Units Balance */}
      <Link
        href="/dashboard/share"
        className={cardLinkClass}
        aria-label="Load or share wallet units"
      >
        <Card className={`border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-white dark:border-emerald-400/25 dark:from-emerald-950/35 dark:via-slate-900 dark:to-slate-950 ${clickableCardClass}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Wallet Unit Balance</CardDescription>
              <WalletIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-3xl">
              {walletUnitsBalance.toFixed(2)} units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Units available to share to your meter or another meter
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Pending Applications */}
      <Link
        href="/dashboard/myloans"
        className={cardLinkClass}
        aria-label="View pending loan applications"
      >
        <Card className={`border-amber-200/60 bg-gradient-to-br from-amber-50/70 to-white dark:border-amber-400/25 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-950 ${clickableCardClass}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Pending Applications</CardDescription>
              <AlertCircleIcon className="h-4 w-4 text-yellow-500" />
            </div>
            <CardTitle className="text-3xl">
              {stats.pending_applications}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Awaiting approval</div>
          </CardContent>
        </Card>
      </Link>

      {/* Outstanding Balance */}
      <Link
        href="/dashboard/myloans"
        className={cardLinkClass}
        aria-label="View outstanding loan payback"
      >
        <Card className={`border-orange-200/60 bg-gradient-to-br from-orange-50/70 to-white dark:border-orange-400/25 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-950 ${clickableCardClass}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Outstanding Payback</CardDescription>
              <DollarSignIcon className="h-4 w-4 text-orange-500" />
            </div>
            <CardTitle className="text-3xl">
              {formatCurrency(stats.outstanding_balance)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Amount yet to be repaid
            </div>
          </CardContent>
        </Card>
      </Link>
      </div>

      {/* Quick Actions Card */}
      <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-card/95 dark:shadow-black/20">
        <CardHeader className="pb-2">
          <CardDescription>Quick Actions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/request-loan">
              <FileTextIcon className="h-4 w-4 mr-2" />
              Apply for Loan
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/myloans">
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              View My Loans
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
