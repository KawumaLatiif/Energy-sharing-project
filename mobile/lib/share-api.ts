import { apiRequest } from "@/lib/api";

export type ShareRecipientPreview = {
  name: string;
  meter_number: string;
  meter_type: string;
  meter_type_label: string;
  phone_number: string;
};

export async function getShareReceiverPreview(meter_number: string) {
  return apiRequest<{
    success?: boolean;
    error?: string;
    recipient?: ShareRecipientPreview;
    delivery_method?: string;
  }>(`share/receiver-preview/?meter_number=${encodeURIComponent(meter_number)}`);
}

export async function initiateShare(meter_number: string, units: number) {
  return apiRequest<{
    success?: boolean;
    message?: string;
    transaction_ref?: string;
    requires_verification?: boolean;
  }>("share/share-units/", {
    method: "POST",
    body: JSON.stringify({ meter_number, units }),
  });
}

export async function verifyShare(verification_code: string, transaction_ref: string) {
  return apiRequest<{ success?: boolean; message?: string; token?: string }>(
    "share/share-units/",
    {
      method: "POST",
      body: JSON.stringify({ verification_code, transaction_ref }),
    }
  );
}
