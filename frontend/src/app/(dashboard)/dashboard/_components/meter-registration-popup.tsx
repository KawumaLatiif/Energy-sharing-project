"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
// import { useRouter } from "next/navigation";
import { registerMeter } from "../request-loan/register-meter/action";

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
  forceCompletion = false
}: MeterRegistrationPopupProps) {
  const [meterNo, setMeterNo] = useState("");
  const [staticIp, setStaticIp] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // const router = useRouter();

  // Validation helpers
  const isValidMeterNumber = (meterNo: string) => {
    const meterPattern = /^\d{10,12}$/;
    return meterPattern.test(meterNo);
  };

  const isValidIP = (ip: string) => {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  };

  const [isAuthValid, setIsAuthValid] = useState(true);

useEffect(() => {
  if (isOpen) {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/v1/auth/get-user-config/');
        if (response.status === 401) {
          setIsAuthValid(false);
          // Clear and redirect
          document.cookie = 'Authentication=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          document.cookie = 'RefreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          window.location.href = '/auth/login';
          return;
        }
        setIsAuthValid(true);
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    checkAuth();
  }
}, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const result = await registerMeter({
        meter_no: meterNo.trim(),
        static_ip: staticIp.trim(),
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Meter registered successfully!' });
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.error || "Failed to register meter" });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!forceCompletion) {
      onClose();
    }
    // If forceCompletion is true, don't allow closing
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md relative">
        {/* Only show close button if not forced completion */}
        {!forceCompletion && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={handleClose}
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
              ? "You need to register your meter to continue" 
              : "Complete your profile to access electricity loans and services"
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
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
                  !isValidIP(staticIp) && staticIp.length > 0 && "border-destructive"
                )}
              />
              {!isValidIP(staticIp) && staticIp.length > 0 && (
                <p className="text-xs text-destructive">Please enter a valid IP address</p>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Find meter number on your electricity bill or meter display</p>
              <p>• Contact electricity provider for static IP address</p>
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