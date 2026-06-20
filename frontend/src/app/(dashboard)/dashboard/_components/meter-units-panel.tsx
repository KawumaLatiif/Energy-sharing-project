"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/fetch-client";
import { useSelectedMeter } from "./selected-meter-context";
import MeterSelector from "./meter-selector";
import GenerateTokenCard from "../tokens/_components/generate-token-card";
import AmiStatusCard from "./ami-status-card";

export default function MeterUnitsPanel() {
  const { selectedMeter, meters, isLoading } = useSelectedMeter();
  const [walletBalance, setWalletBalance] = useState(0);

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

  async function refreshWallet() {
    try {
      const res = await get<any>("wallet/balance");
      if (!res.error && res.data?.success) {
        const bal = parseFloat(
          res.data?.wallet?.balance ?? res.data?.wallet_balance ?? "0"
        );
        setWalletBalance(Number.isFinite(bal) ? bal : 0);
      }
    } catch {
      /* keep current balance */
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Loading meter details...
      </div>
    );
  }

  if (!selectedMeter || meters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <MeterSelector />
      {selectedMeter.architecture === "STS" ? (
        <GenerateTokenCard
          architecture="STS"
          walletBalance={walletBalance}
          meterNo={selectedMeter.meter_number}
          stsMeters={meters.filter((m) => m.architecture === "STS")}
          onTokenGenerated={() => {
            /* wallet balance will refresh on next navigation; optional future hook */
          }}
        />
      ) : (
        <AmiStatusCard
          meter={selectedMeter}
          walletBalance={walletBalance}
          onApplied={refreshWallet}
        />
      )}
    </div>
  );
}
