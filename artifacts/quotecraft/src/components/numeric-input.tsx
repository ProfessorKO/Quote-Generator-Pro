import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type NumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function NumericInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const parsed = parseFloat(next);
        if (next !== "" && !Number.isNaN(parsed)) {
          onValueChange(parsed);
        }
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}
