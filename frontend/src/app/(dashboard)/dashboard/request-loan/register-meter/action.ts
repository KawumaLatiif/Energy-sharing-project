'use server';

import { post } from "@/lib/fetch";

export async function registerMeter(formData: { meter_no: string; static_ip: string }) {
    try {
        console.log('Attempting to register meter:', formData);
        const response = await post<any>('meter/register/', formData);
        console.log('Registration response:', response);

        if (response.error) {
            console.error('Meter registration API error:', response.error);
            return {
                error: response.error.message || response.error.detail || "Failed to register meter",
            };
        }

        return { success: "Meter registered successfully!", data: response.data };
    } catch (err: any) {
        console.error("Meter registration error:", err);

        // More specific error messages
        if (err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
            return { error: "Network error. Please check your connection and try again." };
        }

        if (err.status === 401) {
            return { error: "Please log in to register a meter." };
        }

        if (err.status === 400) {
            return { error: err.message || "Invalid meter data. Please check your inputs." };
        }

        return { error: "Failed to register meter. Please try again." };
    }
}