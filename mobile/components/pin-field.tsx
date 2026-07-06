import { FieldLabel, Input } from "@/components/ui";

export const PIN_LENGTH = 4;

type PinFieldProps = {
  value: string;
  onChangeText: (pin: string) => void;
  label?: string;
  editable?: boolean;
};

/**
 * Transaction-PIN field used as the final authentication step before buying,
 * sharing, or requesting a loan. Numeric, masked, fixed length.
 */
export function PinField({
  value,
  onChangeText,
  label = "Transaction PIN",
  editable = true,
}: PinFieldProps) {
  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChangeText={(text) =>
          onChangeText(text.replace(/\D/g, "").slice(0, PIN_LENGTH))
        }
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        placeholder="••••"
        editable={editable}
      />
    </>
  );
}
