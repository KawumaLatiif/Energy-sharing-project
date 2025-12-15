"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { post } from "@/lib/fetch"; // Import the post utility
import { registerMeter } from "./register-meter/action";

interface RegisterMeterProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function RegisterMeter({ onSuccess, onError }: RegisterMeterProps) {
  const [meterNo, setMeterNo] = useState("");
  const [staticIp, setStaticIp] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Validation helpers
  const isValidMeterNumber = (meterNo: string) => {
    const meterPattern = /^\d{10,12}$/; // 10-12 digits
    return meterPattern.test(meterNo);
  };

  const isValidIP = (ip: string) => {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!isValidMeterNumber(meterNo)) {
      setMessage({ type: 'error', text: 'Please enter a valid 10-12 digit meter number' });
      return;
    }

    if (!isValidIP(staticIp)) {
      setMessage({ type: 'error', text: 'Please enter a valid IP address' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Use the server action
      const result = await registerMeter({
        meter_no: meterNo.trim(),
        static_ip: staticIp.trim(),
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Meter registered successfully! You can now apply for electricity loans.' });

        // Clear form
        setMeterNo("");
        setStaticIp("");

        // Notify parent component
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        } else {
          // Auto-redirect to loan form
          setTimeout(() => {
            router.push('/dashboard/request-loan');
          }, 2000);
        }
      } else {
        const errorMsg = result.error || "Failed to register meter";
        setMessage({ type: 'error', text: errorMsg });

        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "Network error. Please check your connection and try again.";
      setMessage({ type: 'error', text: errorMsg });

      if (onError) {
        onError(errorMsg);
      }
      console.error('Meter registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Error/Success Message */}
        {message && (
          <Alert
            className={cn("mb-4",
              message.type === 'success'
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            )}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.type === 'success' ? 'Success!' : 'Error'}
            </AlertTitle>
            <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="meterNo" className="text-sm font-medium text-foreground">
              Meter Number <span className="text-destructive">*</span>
            </label>
            <Input
              id="meterNo"
              type="text"
              value={meterNo}
              onChange={(e) => setMeterNo(e.target.value.replace(/\D/g, ''))}
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

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Find your meter number on your electricity bill or meter display</p>
            <p>• Contact your electricity provider for the static IP address</p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !meterNo || !staticIp}
          >
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
              onClick={() => router.push('/dashboard/request-loan')}
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