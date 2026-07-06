"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import CardWrapper from "@/components/common/card-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoBanner } from "@/components/ui/info-banner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSelectedMeter } from "@/contexts/selected-meter-context";
import MeterLoadDialog from "@/app/(dashboard)/dashboard/_components/meter-load-dialog";
import type { UserMeter } from "@/interface/meter.interface";
import Link from "next/link";

const LoadSchema = z.object({
  units: z
    .number()
    .min(0.01, "Enter a positive amount")
    .max(10000, "Amount too large"),
});

type LoadFormValues = z.infer<typeof LoadSchema>;

interface LoadUnitsFormProps {
  onBack: () => void;
}

export default function LoadUnitsForm({ onBack }: LoadUnitsFormProps) {
  const { meters, walletBalance, refreshWallet, isLoading } = useSelectedMeter();
  const [selectedMeter, setSelectedMeter] = useState<UserMeter | null>(meters[0] ?? null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [reviewAmount, setReviewAmount] = useState<number | undefined>();

  const form = useForm<LoadFormValues>({
    resolver: zodResolver(LoadSchema),
    defaultValues: { units: 1 },
  });

  useEffect(() => {
    setSelectedMeter(meters[0] ?? null);
  }, [meters]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  if (!meters.length) {
    return (
      <CardWrapper title="Load Units" maxWidth="xl">
        <p className="text-muted-foreground text-sm mb-4">
          Register a meter first to load units from your wallet.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button asChild className="gpawa-gradient text-white">
            <Link href="/dashboard/my-meters">Go to My Meters</Link>
          </Button>
        </div>
      </CardWrapper>
    );
  }

  const handleSubmit = (data: LoadFormValues) => {
    if (data.units > walletBalance) {
      form.setError("units", {
        message: `Insufficient wallet balance. Available: ${walletBalance.toFixed(2)} kWh.`,
      });
      return;
    }
    setReviewAmount(data.units);
    setLoadOpen(true);
  };

  const isAmi = selectedMeter?.architecture === "AMI";

  return (
    <>
      <CardWrapper title="Load Units" maxWidth="xl">
        <Button type="button" variant="ghost" size="sm" className="mb-4 -ml-2" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to menu
        </Button>

        <InfoBanner variant="info">
          {isAmi
            ? "AMI meters receive units directly over the network (ThingsBoard). STS meters receive a keypad token to enter on your CIU."
            : "STS meters receive a keypad token. Select an AMI meter to load units directly to the device."}
        </InfoBanner>

        <div className="mt-4 mb-4 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Wallet balance
          </span>
          <span className="font-bold tabular-nums">
            {isLoading ? "…" : `${walletBalance.toFixed(2)} kWh`}
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormItem>
              <FormLabel>Meter</FormLabel>
              <Select
                value={selectedMeter?.meter_number ?? ""}
                onValueChange={(v) => setSelectedMeter(meters.find((m) => m.meter_number === v) ?? null)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select meter" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {meters.map((m) => (
                    <SelectItem key={m.meter_number} value={m.meter_number}>
                      {m.label && m.label !== "Home" ? `${m.label} · ` : ""}
                      {m.meter_number} ({m.architecture})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>

            <FormField
              control={form.control}
              name="units"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>kWh to load</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={walletBalance}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Max: {walletBalance.toFixed(2)} kWh (wallet)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading || walletBalance <= 0 || !selectedMeter}
              className="w-full gpawa-gradient text-white"
            >
              Review & load
            </Button>
          </form>
        </Form>
      </CardWrapper>

      <MeterLoadDialog
        meter={selectedMeter}
        open={loadOpen}
        onOpenChange={setLoadOpen}
        walletBalance={walletBalance}
        initialAmount={reviewAmount}
        onWalletBalanceChange={() => {
          void refreshWallet();
        }}
        onSuccess={() => {
          void refreshWallet();
        }}
      />
    </>
  );
}
