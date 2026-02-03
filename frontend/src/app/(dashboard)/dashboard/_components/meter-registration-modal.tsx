"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Zap, X, Wifi, Battery, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { post, get } from "@/lib/fetch";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";

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
  userData 
}: MeterManagementModalProps) {
  const [meterData, setMeterData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    meter_no: "",
    static_ip: "",
  });

  // Validation helpers
  const isValidMeterNumber = (meterNo: string) => {
    const meterPattern = /^\d{10,12}$/;
    return meterPattern.test(meterNo);
  };

  const isValidIP = (ip: string) => {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  };

  // Fetch meter data
  const fetchMeterData = async () => {
    setIsRefreshing(true);
    try {
      const response = await get<any>('meter/my-meter/');
      if (!response.error && response.data) {
        setMeterData(response.data);
        if (response.data.success && response.data.data.has_meter) {
          setFormData({
            meter_no: response.data.data.meter_number || "",
            static_ip: response.data.data.static_ip || "",
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch meter data:', error);
      setMessage({ type: 'error', text: 'Failed to load meter data' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMeterData();
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidMeterNumber(formData.meter_no)) {
      setMessage({ type: 'error', text: 'Please enter a valid 10-12 digit meter number' });
      return;
    }

    if (!isValidIP(formData.static_ip)) {
      setMessage({ type: 'error', text: 'Please enter a valid IP address' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Check if meter exists
      if (meterData?.success && meterData.data.has_meter) {
        // Update existing meter
        const response = await post<any>('meter/update/', {
          meter_no: formData.meter_no.trim(),
          static_ip: formData.static_ip.trim(),
        });

        if (response.error) {
          setMessage({ type: 'error', text: response.error.message || "Failed to update meter" });
        } else {
          setMessage({ type: 'success', text: 'Meter updated successfully!' });
          setIsEditing(false);
          fetchMeterData();
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      } else {
        // Register new meter
        const response = await post<any>('meter/register/', {
          meter_no: formData.meter_no.trim(),
          static_ip: formData.static_ip.trim(),
        });

        if (response.error) {
          setMessage({ type: 'error', text: response.error.message || "Failed to register meter" });
        } else {
          setMessage({ type: 'success', text: 'Meter registered successfully!' });
          setIsEditing(false);
          fetchMeterData();
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={handleClose}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 mx-auto">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-lg">
            {meterData?.success && meterData.data.has_meter 
              ? "Manage Your Electricity Meter" 
              : "Register Your Electricity Meter"
            }
          </CardTitle>
          <CardDescription>
            {meterData?.success && meterData.data.has_meter
              ? "View and update your meter information"
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

          {/* Meter Status Summary */}
          {meterData && !isEditing && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Current Meter Status</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchMeterData}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              {meterData.success && meterData.data.has_meter ? (
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
                        <span className="text-sm font-medium text-gray-800">Static IP</span>
                      </div>
                      <p className="text-lg font-mono text-gray-500">{meterData.data.static_ip}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border">
                    <div className="flex items-center space-x-2 mb-1">
                      <Battery className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-800">Available Units</span>
                    </div>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-bold text-green-600">
                        {meterData.data.units?.toFixed(2) || '0.00'}
                      </p>
                      <span className="ml-1 text-gray-600">units</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2 ">
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 rounded border"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Meter
                    </Button>
                    <Button
                      variant="outline"
                      onClick={fetchMeterData}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                  <h4 className="font-medium text-yellow-800 mb-2">No Meter Registered</h4>
                  <p className="text-sm text-yellow-700 mb-4">
                    You haven't registered a meter yet. Register a meter to start using electricity services.
                  </p>
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Register Meter
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Edit/Register Form */}
          {(isEditing || !meterData?.success || !meterData.data.has_meter) && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    !isValidMeterNumber(formData.meter_no) && formData.meter_no.length > 0 && "border-destructive"
                  )}
                />
                {!isValidMeterNumber(formData.meter_no) && formData.meter_no.length > 0 && (
                  <p className="text-xs text-destructive">Please enter a valid 10-12 digit meter number</p>
                )}
              </div>

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
                    !isValidIP(formData.static_ip) && formData.static_ip.length > 0 && "border-destructive"
                  )}
                />
                {!isValidIP(formData.static_ip) && formData.static_ip.length > 0 && (
                  <p className="text-xs text-destructive">Please enter a valid IP address</p>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Find meter number on your electricity bill or meter display</p>
                <p>• Contact electricity provider for static IP address</p>
                {meterData?.success && meterData.data.has_meter && (
                  <p className="text-amber-600">• Updating your meter details may require re-verification</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsEditing(false);
                      fetchMeterData();
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  className={isEditing ? "flex-1" : "w-full"}
                  disabled={isLoading || !formData.meter_no || !formData.static_ip}
                >
                  {isLoading ? (
                    <>
                      <Zap className="h-4 w-4 mr-2 animate-spin" />
                      {meterData?.success && meterData.data.has_meter ? 'Updating...' : 'Registering...'}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {meterData?.success && meterData.data.has_meter ? 'Update Meter' : 'Register Meter'}
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
