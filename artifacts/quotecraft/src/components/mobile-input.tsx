import { Input } from "@/components/ui/input";
import { sanitizeMobileDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MobileInputProps {
  value: string; // the 8 user digits
  onChange: (digits: string) => void;
  id?: string;
  className?: string;
}

// Fixed, read-only "+61 4" prefix; the user types the remaining 8 digits.
export function MobileInput({ value, onChange, id, className }: MobileInputProps) {
  return (
    <div
      className={cn(
        "flex items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <span className="flex items-center px-3 bg-secondary text-secondary-foreground text-sm font-medium select-none border-r border-input">
        +61&nbsp;4
      </span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="XXXX XXXX"
        value={value}
        onChange={(e) => onChange(sanitizeMobileDigits(e.target.value))}
        className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
      />
    </div>
  );
}
