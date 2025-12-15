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
  TrendingUpIcon,
  DollarSignIcon,
  AlertCircleIcon,
} from "lucide-react";
import { get } from "@/lib/fetch";
import { useEffect, useState } from "react";

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

        if (response.error) {
          console.warn("Failed to fetch loan stats:", response.error);
          return;
        }

        setStats(response.data);
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

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Active Loans */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Active Loans</CardDescription>
            <ClockIcon className="h-4 w-4 text-blue-500" />
          </div>
          <CardTitle className="text-4xl">{stats.active_loans}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Currently active electricity loans
          </div>
        </CardContent>
      </Card>

      {/* Pending Applications */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Pending Applications</CardDescription>
            <AlertCircleIcon className="h-4 w-4 text-yellow-500" />
          </div>
          <CardTitle className="text-4xl">
            {stats.pending_applications}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">Awaiting approval</div>
        </CardContent>
      </Card>

      {/* Approved Loans */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Approved Loans</CardDescription>
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          </div>
          <CardTitle className="text-4xl">{stats.approved_loans}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Successfully approved
          </div>
        </CardContent>
      </Card>

      {/* Total Loans */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Total Loans</CardDescription>
            <TrendingUpIcon className="h-4 w-4 text-purple-500" />
          </div>
          <CardTitle className="text-4xl">{stats.total_loans}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            All-time applications
          </div>
        </CardContent>
      </Card>

      {/* Total Borrowed */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Total Borrowed</CardDescription>
            <DollarSignIcon className="h-4 w-4 text-green-500" />
          </div>
          <CardTitle className="text-3xl">
            {formatCurrency(stats.total_borrowed)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total amount borrowed
          </div>
        </CardContent>
      </Card>

      {/* Total Repayments */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Total Repayments</CardDescription>
            <DollarSignIcon className="h-4 w-4 text-blue-500" />
          </div>
          <CardTitle className="text-3xl">
            {formatCurrency(stats.total_repayments)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">Amount repaid</div>
        </CardContent>
      </Card>

      {/* Outstanding Balance */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Outstanding Payback Amount</CardDescription>
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

      {/* Quick Actions Card */}
      <Card className="md:col-span-2 lg:col-span-4">
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
