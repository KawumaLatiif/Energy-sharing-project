"use client";

import { Suspense, useEffect, useState } from "react";
import TokenList from "./_components/tokenslist";
import GenerateTokenCard from "./_components/generate-token-card";
import AmiStatusCard from "../_components/ami-status-card";
import MeterSelector from "../_components/meter-selector";
import { useSelectedMeter } from "../_components/selected-meter-context";
import { get } from "@/lib/fetch";
import { Token } from "@/interface/token.interface";

interface TokensPageClientProps {
  initialTokens: Token[];
}

export default function TokensPageClient({ initialTokens }: TokensPageClientProps) {
  const { selectedMeter, meters, isLoading } = useSelectedMeter();
  const [walletBalance, setWalletBalance] = useState(0);
  const [tokens, setTokens] = useState(initialTokens);

  useEffect(() => {
    async function loadWallet() {
      try {
        const res = await get<any>("wallet/balance");
        if (!res.error && res.data?.success) {
          const bal = parseFloat(
            res.data?.wallet?.balance ?? res.data?.wallet_balance ?? "0"
          );
          setWalletBalance(Number.isFinite(bal) ? bal : 0);
        }
      } catch {
        setWalletBalance(0);
      }
    }
    loadWallet();
  }, [selectedMeter?.meter_number]);

  useEffect(() => {
    async function loadTokens() {
      if (!selectedMeter) return;
      try {
        const res = await get<any>(
          `meter/token/?meter_no=${encodeURIComponent(selectedMeter.meter_number)}`
        );
        if (!res.error) {
          const list = Array.isArray(res.data?.data)
            ? res.data.data
            : res.data?.results ?? [];
          setTokens(list);
        }
      } catch {
        setTokens([]);
      }
    }
    loadTokens();
  }, [selectedMeter?.meter_number]);

  const hasMeter = meters.length > 0;

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">Tokens</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedMeter?.architecture === "AMI"
            ? "AMI meters sync balance over the network — no tokens required"
            : "Generate and manage STS meter tokens"}
        </p>
      </div>

      {hasMeter && !isLoading && selectedMeter && (
        <div className="space-y-4">
          <MeterSelector />
          {selectedMeter.architecture === "STS" ? (
            <GenerateTokenCard
              architecture="STS"
              walletBalance={walletBalance}
              meterNo={selectedMeter.meter_number}
              stsMeters={meters.filter((m) => m.architecture === "STS")}
            />
          ) : (
            <AmiStatusCard meter={selectedMeter} walletBalance={walletBalance} />
          )}
        </div>
      )}

      {!hasMeter && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Register a meter first to generate tokens.
        </div>
      )}

      <div className="flex min-w-0 flex-1 justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex min-w-0 flex-col gap-1 w-full">
          <Suspense fallback={<div className="p-4">Loading tokens...</div>}>
            <TokenList tokens={tokens} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
