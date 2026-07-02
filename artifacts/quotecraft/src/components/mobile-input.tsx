import { Input } from "@/components/ui/input";
import { MOBILE_PREFIX_DISPLAY, sanitizeMobileDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MobileInputProps {
  value: string; // the 8 user digits
  onChange: (digits: string) => void;
  onBlur?: (digits: string) => void;
  invalid?: boolean;
  id?: string;
  className?: string;
}

// Fixed, read-only "+61-04" prefix; the user types the remaining 8 digits.
export function MobileInput({
  value,
  onChange,
  onBlur,
  invalid,
  id,
  className,
}: MobileInputProps) {
  return (
    <div
      className={cn(
        "flex items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring",
        invalid && "border-destructive focus-within:ring-destructive",
        className,
      )}
    >
      <span className="flex items-center px-3 bg-secondary text-secondary-foreground text-sm font-medium select-none border-r border-input">
        {MOBILE_PREFIX_DISPLAY}
      </span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="XXXX XXXX"
        maxLength={8}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(sanitizeMobileDigits(e.target.value))}
        onBlur={(e) => onBlur?.(sanitizeMobileDigits(e.target.value))}
        className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
      />
    </div>
  );
}
