"use client";

import { useState } from "react";
import { Zap, Loader2, Copy, Check, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { post } from "@/lib/fetch";
import { getApiErrorMessage } from "@/lib/api-response";
import { cn } from "@/lib/utils";

interface GenerateTokenCardProps {
  architecture: "STS" | "AMI";
  walletBalance: number;
}

export default function GenerateTokenCard({ architecture, walletBalance }: GenerateTokenCardProps) {
  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ token: string; units: number; remaining: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // AMI meters: units applied automatically over the network
  if (architecture === "AMI") {
    return (
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">AMI Meter — Automatic Updates</CardTitle>
          </div>
          <CardDescription>
            Your meter is networked. When you buy units they are applied to your meter automatically
            over the network — no token entry is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Wallet balance</span>
            <span className="font-bold tabular-nums">{walletBalance.toFixed(2)} kWh</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Balance updates may take a few minutes to reflect on the physical meter after a purchase or share.
          </p>
        </CardContent>
      </Card>
    );
  }

  // STS meters: generate a token to load units via keypad
  async function handleGenerate() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid kWh amount.");
      return;
    }
    if (amt > walletBalance) {
      setError(`You only have ${walletBalance.toFixed(2)} kWh available.`);
      return;
    }

    setIsPending(true);
    setError("");
    setResult(null);

    try {
      const res = await post<any>("meter/generate-token/", { amount: amt });
      if (res.data?.success) {
        setResult({
          token: res.data.token,
          units: res.data.units,
          remaining: res.data.remaining_balance,
        });
        setAmount("");
      } else {
        setError(getApiErrorMessage(res.error, res.data?.error || "Failed to generate token."));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function copyToken() {
    if (!result) return;
    await navigator.clipboard.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Generate Meter Token</CardTitle>
        </div>
        <CardDescription>
          Draw kWh from your wallet and get a token to enter on your STS meter keypad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet balance */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Available in wallet</span>
          <span className="font-bold tabular-nums">{walletBalance.toFixed(2)} kWh</span>
        </div>

        {/* Amount input */}
        {walletBalance > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="token-amount">kWh to load onto meter</Label>
            <div className="flex gap-2">
              <Input
                id="token-amount"
                type="number"
                min="0.01"
                max={walletBalance}
                step="0.01"
                placeholder="e.g. 10"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); setResult(null); }}
                disabled={isPending}
                className="flex-1"
              />
              <Button
                onClick={handleGenerate}
                disabled={isPending || !amount}
                className="gpawa-gradient text-white shrink-0"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1.5" />
                    Generate
                  </>
                )}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No units in wallet. Buy units first to generate a token.
          </p>
        )}

        {/* Token result */}
        {result && (
          <div className="rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              Token generated — {result.units.toFixed(2)} kWh
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-2xl font-mono font-bold tracking-widest bg-white dark:bg-slate-900 rounded px-3 py-2 border select-all">
                {result.token}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={copyToken}
                title="Copy token"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter this code on your meter keypad to load {result.units.toFixed(2)} kWh.
              Remaining wallet balance: <strong>{result.remaining.toFixed(2)} kWh</strong>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
