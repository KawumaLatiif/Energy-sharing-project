"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Zap, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { post } from "@/lib/fetch";
import { getApiErrorMessage } from "@/lib/api-response";
import MeterArchitecturePicker, {
  type MeterArchitecture,
} from "./meter-architecture-picker";

interface MeterRegistrationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  forceCompletion?: boolean;
}

export default function MeterRegistrationPopup({
  isOpen,
  onClose,
  onSuccess,
  forceCompletion = false,
}: MeterRegistrationPopupProps) {
  const [architecture, setArchitecture] = useState<MeterArchitecture>("STS");
  const [meterNo, setMeterNo] = useState("");
  const [staticIp, setStaticIp] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValidMeterNumber = (v: string) => /^\d{10,12}$/.test(v);
  const isValidIP = (v: string) =>
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v);

  const handleArchChange = (arch: MeterArchitecture) => {
    setArchitecture(arch);
    if (arch === "STS") setStaticIp("");
  };

  useEffect(() => {
    if (isOpen) {
      const checkAdmin = async () => {
        try {
          const response = await fetch("/api/v1/auth/get-user-config/");
          if (response.status === 401) {
            document.cookie = "Authentication=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = "RefreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = "/auth/login";
            return;
          }
          const userData = await response.json();
          if (userData.is_admin || userData.user_role === "ADMIN") {
            onSuccess();
          }
        } catch {}
      };
      checkAdmin();
    }
  }, [isOpen, onSuccess]);

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

    const payload: Record<string, string> = {
      meter_no: meterNo.trim(),
      architecture,
    };
    if (label.trim()) payload.label = label.trim();
    if (architecture === "AMI") {
      payload.static_ip = staticIp.trim();
    }

    try {
      const response = await post<any>("meter/register/", payload);
      if (response.error) {
        setMessage({ type: "error", text: getApiErrorMessage(response.error, "Failed to register meter") });
      } else {
        setMessage({ type: "success", text: "Meter registered successfully!" });
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit =
    isValidMeterNumber(meterNo) &&
    (architecture === "STS" || isValidIP(staticIp));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg relative my-4">
        {!forceCompletion && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 mx-auto">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-lg">
            {forceCompletion ? "Step 1: Register Your Electricity Meter" : "Register Your Electricity Meter"}
          </CardTitle>
          <CardDescription>
            {forceCompletion
              ? "Choose STS or AMI, then add your first meter. You can register more meters later (e.g. rental units) under the same login."
              : "One account can manage multiple meters and sub-meters — ideal for landlords with several rental units."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {message && (
            <Alert
              className={cn(
                "mb-4",
                message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
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
              <AlertDescription className={message.type === "success" ? "text-green-700" : "text-red-700"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <MeterArchitecturePicker
              value={architecture}
              onChange={handleArchChange}
              disabled={isLoading}
            />

            <div className="space-y-2">
              <Label htmlFor="meterLabel">Unit label (optional)</Label>
              <Input
                id="meterLabel"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Flat 2B, Shop front"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meterNo">
                Meter Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meterNo"
                type="text"
                value={meterNo}
                onChange={(e) => setMeterNo(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 10-12 digit meter number"
                maxLength={12}
                required
                disabled={isLoading}
                className={cn(
                  !isValidMeterNumber(meterNo) && meterNo.length > 0 && "border-destructive"
                )}
              />
              {!isValidMeterNumber(meterNo) && meterNo.length > 0 && (
                <p className="text-xs text-destructive">Please enter a valid 10-12 digit meter number</p>
              )}
            </div>

            {architecture === "AMI" && (
              <div className="space-y-2">
                <Label htmlFor="staticIp">
                  Static IP Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="staticIp"
                  type="text"
                  value={staticIp}
                  onChange={(e) => setStaticIp(e.target.value)}
                  placeholder="192.168.1.100"
                  required
                  disabled={isLoading}
                  className={cn(
                    !isValidIP(staticIp) && staticIp.length > 0 && "border-destructive"
                  )}
                />
                {!isValidIP(staticIp) && staticIp.length > 0 && (
                  <p className="text-xs text-destructive">Please enter a valid IP address</p>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Find your meter number on your electricity bill or the meter display</p>
              {architecture === "AMI" && (
                <p>• Contact your Electricity Utility for the static IP address</p>
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
                  {forceCompletion ? "Continue to Next Step" : "Register Meter"}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
