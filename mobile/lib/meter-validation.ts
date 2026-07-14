export const METER_NO_MAX_LENGTH = 100;

export function isValidMeterNumber(value: string): boolean {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 && trimmed.length <= METER_NO_MAX_LENGTH;
}
