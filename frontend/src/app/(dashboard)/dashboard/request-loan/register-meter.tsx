"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { registerMeter } from "./register-meter/action";

type Architecture = "STS" | "AMI";

interface RegisterMeterProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function RegisterMeter({ onSuccess, onError }: RegisterMeterProps) {
  const [architecture, setArchitecture] = useState<Architecture>("STS");
  const [meterNo, setMeterNo] = useState("");
  const [staticIp, setStaticIp] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const isValidMeterNumber = (v: string) => /^\d{10,12}$/.test(v);
  const isValidIP = (v: string) =>
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
      v
    );

  const handleArchChange = (arch: Architecture) => {
    setArchitecture(arch);
    if (arch === "STS") setStaticIp("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidMeterNumber(meterNo)) {
      setMessage({ type: "error", text: "Please enter a valid 10-12 digit meter number" });
      return;
    }

    if (architecture === "AMI" && !isValidIP(staticIp)) {
      setMessage({ type: "error", text: "Please enter a valid IP address for your AMI meter" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const payload: { meter_no: string; architecture: Architecture; static_ip?: string } = {
      meter_no: meterNo.trim(),
      architecture,
    };
    if (architecture === "AMI") {
      payload.static_ip = staticIp.trim();
    }

    try {
      const result = await registerMeter(payload);

      if (result.success) {
        setMessage({
          type: "success",
          text: "Meter registered successfully! You can now apply for electricity loans.",
        });
        setMeterNo("");
        setStaticIp("");
        setArchitecture("STS");

        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        } else {
          setTimeout(() => router.push("/dashboard/request-loan"), 2000);
        }
      } else {
        const errorMsg = result.error || "Failed to register meter";
        setMessage({ type: "error", text: errorMsg });
        onError?.(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Network error. Please check your connection and try again.";
      setMessage({ type: "error", text: errorMsg });
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    isValidMeterNumber(meterNo) && (architecture === "STS" || isValidIP(staticIp));

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 mx-auto">
          <Zap className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-xl">Register Electricity Meter</CardTitle>
        <CardDescription>
          Connect your meter to access electricity loans and track your consumption
        </CardDescription>
      </CardHeader>

      <CardContent>
        {message && (
          <Alert
            className={cn(
              "mb-4",
              message.type === "success"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={message.type === "success" ? "text-green-800" : "text-red-800"}>
              {message.type === "success" ? "Success!" : "Error"}
            </AlertTitle>
            <AlertDescription
              className={message.type === "success" ? "text-green-700" : "text-red-700"}
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>
              Meter Type <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {(["STS", "AMI"] as Architecture[]).map((arch) => (
                <button
                  key={arch}
                  type="button"
                  onClick={() => handleArchChange(arch)}
                  disabled={isLoading}
                  className={cn(
                    "rounded-lg border-2 p-3 text-left transition-colors",
                    architecture === arch
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-border hover:border-blue-300"
                  )}
                >
                  <div className="font-semibold text-sm">{arch}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {arch === "STS" ? "Token keypad entry" : "Networked, auto-update"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="meterNo" className="text-sm font-medium text-foreground">
              Meter Number <span className="text-destructive">*</span>
            </label>
            <Input
              id="meterNo"
              type="text"
              value={meterNo}
              onChange={(e) => setMeterNo(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter your 10-12 digit meter number"
              maxLength={12}
              required
              disabled={isLoading}
              className={cn(
                !isValidMeterNumber(meterNo) && meterNo.length > 0 && "border-destructive",
                "w-full"
              )}
            />
            {!isValidMeterNumber(meterNo) && meterNo.length > 0 && (
              <p className="text-xs text-destructive">Please enter a valid 10-12 digit meter number</p>
            )}
          </div>

          {architecture === "AMI" && (
            <div className="space-y-2">
              <label htmlFor="staticIp" className="text-sm font-medium text-foreground">
                Static IP Address <span className="text-destructive">*</span>
              </label>
              <Input
                id="staticIp"
                type="text"
                value={staticIp}
                onChange={(e) => setStaticIp(e.target.value)}
                placeholder="192.168.1.100"
                required
                disabled={isLoading}
                className={cn(
                  !isValidIP(staticIp) && staticIp.length > 0 && "border-destructive",
                  "w-full"
                )}
              />
              {!isValidIP(staticIp) && staticIp.length > 0 && (
                <p className="text-xs text-destructive">Please enter a valid IP address</p>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Find your meter number on your electricity bill or meter display</p>
            {architecture === "AMI" && (
              <p>• Contact your electricity provider for the static IP address</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !canSubmit}>
            {isLoading ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Register Meter
              </>
            )}
          </Button>

          <div className="text-center pt-2">
            <Button
              type="button"
              variant="link"
              onClick={() => router.push("/dashboard/request-loan")}
              disabled={isLoading}
              className="text-sm p-0 h-auto"
            >
              I already have a registered meter
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
