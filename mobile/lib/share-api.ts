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

export async function confirmShare(meter_number: string, units: number, pin: string) {
  return apiRequest<{
    success?: boolean;
    message?: string;
    transaction_id?: string;
    share_token?: string | null;
    units_shared?: string;
    new_sender_wallet_balance?: string;
    receiver_name?: string;
    error?: string;
  }>("share/share-units/", {
    method: "POST",
    body: JSON.stringify({ meter_number, units, pin }),
  });
}
