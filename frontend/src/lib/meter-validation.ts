import { z } from "zod";

export const METER_NO_MIN_LENGTH = 3;
export const METER_NO_MAX_LENGTH = 100;

/** Legacy 10–12 digit meters or alphanumeric codes (e.g. EM_SRT002). */
const METER_NO_PATTERN = /^(?:\d{10,12}|[A-Za-z0-9][A-Za-z0-9_-]{2,99})$/;

export function isValidMeterNumber(value: string): boolean {
  const trimmed = (value || "").trim();
  if (trimmed.length < METER_NO_MIN_LENGTH || trimmed.length > METER_NO_MAX_LENGTH) {
    return false;
  }
  return METER_NO_PATTERN.test(trimmed);
}

export function meterNumberFieldSchema() {
  return z
    .string()
    .trim()
    .min(METER_NO_MIN_LENGTH, `Meter number must be at least ${METER_NO_MIN_LENGTH} characters`)
    .max(METER_NO_MAX_LENGTH, `Meter number must be at most ${METER_NO_MAX_LENGTH} characters`)
    .refine(
      isValidMeterNumber,
      "Invalid meter number. Use letters, numbers, underscores, or hyphens."
    );
}
