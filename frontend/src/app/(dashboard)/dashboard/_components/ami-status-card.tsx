"use client";

import { useCallback, useEffect, useState } from "react";
import { Wifi, RefreshCw, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/fetch";
import type { UserMeter } from "@/interface/meter.interface";

interface AmiStatusCardProps {
  meter: UserMeter;
  walletBalance: number;
}

interface AmiStatus {
  is_online: boolean;
  last_seen: string | null;
  current_balance_kwh: number | null;
}

export default function AmiStatusCard({ meter, walletBalance }: AmiStatusCardProps) {
  const [status, setStatus] = useState<AmiStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    setIsRefreshing(true);
    setError("");
    try {
      const res = await get<any>(
        `meter/ami-status/?meter_no=${encodeURIComponent(meter.meter_number)}`
      );
      if (!res.error && res.data?.success) {
        setStatus({
          is_online: res.data.is_online,
          last_seen: res.data.last_seen ?? null,
          current_balance_kwh: res.data.current_balance_kwh ?? meter.units,
        });
      } else {
        setStatus({
          is_online: false,
          last_seen: null,
          current_balance_kwh: meter.units,
        });
        setError(res.data?.message || "Could not reach meter.");
      }
    } catch {
      setStatus({
        is_online: false,
        last_seen: null,
        current_balance_kwh: meter.units,
      });
      setError("Failed to fetch meter status.");
    } finally {
      setIsRefreshing(false);
    }
  }, [meter.meter_number, meter.units]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const balance = status?.current_balance_kwh ?? meter.units;

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">AMI Meter — Network Sync</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={isRefreshing}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          Purchases and shares debit your wallet and apply to this meter automatically — no token
          entry required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-3">
            <span className="text-sm text-muted-foreground">Meter balance</span>
            <p className="text-xl font-bold tabular-nums mt-1">{balance.toFixed(2)} kWh</p>
          </div>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-3">
            <span className="text-sm text-muted-foreground">Wallet balance</span>
            <p className="text-xl font-bold tabular-nums mt-1">{walletBalance.toFixed(2)} kWh</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Circle
            className={`h-2.5 w-2.5 fill-current ${
              status?.is_online ? "text-green-500" : "text-amber-500"
            }`}
          />
          <span>{status?.is_online ? "Meter online" : "Meter offline or unreachable"}</span>
          {status?.last_seen && (
            <span className="text-muted-foreground text-xs ml-auto">
              Last seen {new Date(status.last_seen).toLocaleString()}
            </span>
          )}
        </div>

        {meter.static_ip && (
          <p className="text-xs text-muted-foreground font-mono">IP: {meter.static_ip}</p>
        )}

        {error && <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>}

        <p className="text-xs text-muted-foreground">
          Balance updates may take a few minutes to reflect on the physical meter after a purchase
          or share.
        </p>
      </CardContent>
    </Card>
  );
}
