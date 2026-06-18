"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Zap, X, Wifi, Battery, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { post, get } from "@/lib/fetch";
import { getApiErrorMessage } from "@/lib/api-response";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";

type Architecture = "STS" | "AMI";

interface MeterManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userData: any;
}

export default function MeterManagementModal({
  isOpen,
  onClose,
  onSuccess,
  userData,
}: MeterManagementModalProps) {
  const [meterData, setMeterData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    meter_no: "",
    static_ip: "",
    architecture: "STS" as Architecture,
  });

  const isValidMeterNumber = (v: string) => /^\d{10,12}$/.test(v);
  const isValidIP = (v: string) =>
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v);

  const fetchMeterData = async () => {
    setIsRefreshing(true);
    try {
      const response = await get<any>("meter/my-meter/");
      if (!response.error && response.data) {
        setMeterData(response.data);
        // Pre-fill form only when there is exactly one meter (editing case)
        const meters: any[] = response.data?.data?.meters ?? [];
        if (response.data.success && response.data.data.has_meter && meters.length === 1) {
          setFormData({
            meter_no: meters[0].meter_number || "",
            static_ip: meters[0].static_ip || "",
            architecture: (meters[0].architecture as Architecture) || "STS",
          });
        } else {
          // For new meter registration, reset form
          setFormData({ meter_no: "", static_ip: "", architecture: "STS" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load meter data" });
    } finally {
      setIsRefreshing(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMeterData(null);
      setIsEditing(false);
      setIsFetching(true);
      fetchMeterData();
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArchChange = (arch: Architecture) => {
    setFormData((prev) => ({ ...prev, architecture: arch, static_ip: arch === "STS" ? "" : prev.static_ip }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidMeterNumber(formData.meter_no)) {
      setMessage({ type: "error", text: "Please enter a valid 10-12 digit meter number" });
      return;
    }

    if (formData.architecture === "AMI" && !isValidIP(formData.static_ip)) {
      setMessage({ type: "error", text: "Please enter a valid IP address for your AMI meter" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const payload: Record<string, string> = {
      meter_no: formData.meter_no.trim(),
      architecture: formData.architecture,
    };
    if (formData.architecture === "AMI") {
      payload.static_ip = formData.static_ip.trim();
    }

    try {
      const isUpdate = meterData?.success && meterData.data.has_meter;
      const endpoint = isUpdate ? "meter/update/" : "meter/register/";
      const response = await post<any>(endpoint, payload);

      if (response.error) {
        setMessage({ type: "error", text: getApiErrorMessage(response.error, isUpdate ? "Failed to update meter" : "Failed to register meter") });
      } else {
        setMessage({ type: "success", text: isUpdate ? "Meter updated successfully!" : "Meter registered successfully!" });
        setIsEditing(false);
        fetchMeterData();
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasMeter = meterData?.success && meterData.data.has_meter;
  const allMeters: any[] = meterData?.data?.meters ?? [];
  const canAddMore = allMeters.length < 2; // max one STS + one AMI
  const showForm = !isFetching && (isEditing || (meterData?.success && (!hasMeter || canAddMore)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={() => { setIsEditing(false); onClose(); }}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 mx-auto">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-lg">
            {isFetching && !meterData
              ? "Loading Meter Details"
              : hasMeter
              ? "Manage Your Electricity Meter"
              : "Register Your Electricity Meter"}
          </CardTitle>
          <CardDescription>
            {isFetching && !meterData
              ? "Please wait while we load your meter details"
              : hasMeter
              ? "View and update your meter information"
              : "Complete your profile to access electricity services"}
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

          {isFetching && !meterData && (
            <div className="py-8 text-center text-gray-600">Loading meter information...</div>
          )}

          {/* Meter Status Summary */}
          {!isFetching && meterData && !isEditing && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Current Meter Status</h3>
                <Button variant="ghost" size="sm" onClick={fetchMeterData} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {hasMeter ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded border">
                      <div className="flex items-center space-x-2 mb-1">
                        <Wifi className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-800">Meter Number</span>
                      </div>
                      <p className="text-lg font-mono text-gray-500">{meterData.data.meter_number}</p>
                    </div>

                    <div className="bg-white p-3 rounded border">
                      <div className="flex items-center space-x-2 mb-1">
                        <Zap className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-800">Type</span>
                      </div>
                      <p className="text-base font-semibold text-gray-700">
                        {meterData.data.architecture === "AMI" ? "AMI (networked)" : "STS (token)"}
                      </p>
                    </div>
                  </div>

                  {meterData.data.architecture === "AMI" && meterData.data.static_ip && (
                    <div className="bg-white p-3 rounded border">
                      <div className="flex items-center space-x-2 mb-1">
                        <Wifi className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-800">IP Address</span>
                      </div>
                      <p className="font-mono text-gray-500">{meterData.data.static_ip}</p>
                    </div>
                  )}

                  <div className="bg-white p-3 rounded border">
                    <div className="flex items-center space-x-2 mb-1">
                      <Battery className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-800">Available Units</span>
                    </div>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-bold text-green-600">
                        {meterData.data.units?.toFixed(2) || "0.00"}
                      </p>
                      <span className="ml-1 text-gray-600">kWh</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => setIsEditing(true)} className="flex-1 rounded border">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Meter
                    </Button>
                    <Button variant="outline" onClick={fetchMeterData} disabled={isRefreshing}>
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                  <h4 className="font-medium text-yellow-800 mb-2">No Meter Registered</h4>
                  <p className="text-sm text-yellow-700 mb-4">
                    Register a meter to start using electricity services.
                  </p>
                  <Button onClick={() => setIsEditing(true)} className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Register Meter
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Edit / Register Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Architecture choice */}
              <div className="space-y-2">
                <Label>Meter Type <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["STS", "AMI"] as Architecture[]).map((arch) => (
                    <button
                      key={arch}
                      type="button"
                      onClick={() => handleArchChange(arch)}
                      disabled={isLoading}
                      className={cn(
                        "rounded-lg border-2 p-3 text-left transition-colors",
                        formData.architecture === arch
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-border hover:border-blue-300"
                      )}
                    >
                      <div className="font-semibold text-sm">{arch}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {arch === "STS"
                          ? "Token keypad entry"
                          : "Networked, auto-update"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Meter Number */}
              <div className="space-y-2">
                <Label htmlFor="meter_no">
                  Meter Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="meter_no"
                  name="meter_no"
                  type="text"
                  value={formData.meter_no}
                  onChange={handleInputChange}
                  placeholder="Enter 10-12 digit meter number"
                  maxLength={12}
                  required
                  disabled={isLoading}
                  className={cn(
                    !isValidMeterNumber(formData.meter_no) &&
                      formData.meter_no.length > 0 &&
                      "border-destructive"
                  )}
                />
                {!isValidMeterNumber(formData.meter_no) && formData.meter_no.length > 0 && (
                  <p className="text-xs text-destructive">Please enter a valid 10-12 digit meter number</p>
                )}
              </div>

              {/* 3. IP Address — only for AMI */}
              {formData.architecture === "AMI" && (
                <div className="space-y-2">
                  <Label htmlFor="static_ip">
                    Static IP Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="static_ip"
                    name="static_ip"
                    type="text"
                    value={formData.static_ip}
                    onChange={handleInputChange}
                    placeholder="192.168.1.100"
                    required
                    disabled={isLoading}
                    className={cn(
                      !isValidIP(formData.static_ip) &&
                        formData.static_ip.length > 0 &&
                        "border-destructive"
                    )}
                  />
                  {!isValidIP(formData.static_ip) && formData.static_ip.length > 0 && (
                    <p className="text-xs text-destructive">Please enter a valid IP address</p>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Find meter number on your electricity bill or meter display</p>
                {formData.architecture === "AMI" && (
                  <p>• Contact your electricity provider for the static IP address</p>
                )}
                {hasMeter && (
                  <p className="text-amber-600">• Updating meter details may require re-verification</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setIsEditing(false); fetchMeterData(); }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  className={isEditing ? "flex-1" : "w-full"}
                  disabled={
                    isLoading ||
                    !formData.meter_no ||
                    (formData.architecture === "AMI" && !formData.static_ip)
                  }
                >
                  {isLoading ? (
                    <>
                      <Zap className="h-4 w-4 mr-2 animate-spin" />
                      {hasMeter ? "Updating..." : "Registering..."}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {hasMeter ? "Update Meter" : "Register Meter"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
