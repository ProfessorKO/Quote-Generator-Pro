// AU business-profile formatting & validation helpers.
// Mobile is always an Australian mobile: a fixed "+61-04" prefix plus 8 user
// digits. Stored normalized as "+61-04XXXXXXXX", displayed "+61-04 XXXX XXXX".

export const MOBILE_PREFIX_DISPLAY = "+61-04";

/** Keep only digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** The 8 digits the user types (after the leading "+61-04"). Max 8. */
export function sanitizeMobileDigits(value: string): string {
  return digitsOnly(value).slice(0, 8);
}

export function isValidMobileDigits(eightDigits: string): boolean {
  return /^\d{8}$/.test(eightDigits);
}

/** Storage normalization: "12345678" -> "+61-0412345678". Empty input -> "". */
export function formatStoredMobile(eightDigits: string): string {
  const d = sanitizeMobileDigits(eightDigits);
  if (!d) return "";
  return `${MOBILE_PREFIX_DISPLAY}${d}`;
}

/** Display formatting: "12345678" -> "+61-04 1234 5678". Empty input -> "". */
export function formatMobileDisplay(eightDigits: string): string {
  const d = sanitizeMobileDigits(eightDigits);
  if (!d) return "";
  const left = d.slice(0, 4);
  const right = d.slice(4, 8);
  return `${MOBILE_PREFIX_DISPLAY} ${left}${right ? " " + right : ""}`.trim();
}

/**
 * Extract the 8 user digits from a stored mobile. Accepts both the current
 * "+61-04XXXXXXXX" format and legacy "+61 4 XXXX XXXX" values.
 */
export function mobileDigitsFromStored(stored: string | null | undefined): string {
  if (!stored) return "";
  let all = digitsOnly(stored); // "610412345678" or "61412345678"
  if (all.startsWith("61")) all = all.slice(2);
  if (all.startsWith("04")) all = all.slice(2);
  else if (all.startsWith("4") || all.startsWith("0")) all = all.slice(1);
  return all.slice(0, 8);
}

/**
 * Standard mobile validation message (Bug #25). Returns null when valid.
 * Required fields report progress: "(X/8 entered)".
 */
export function mobileValidationError(
  digits: string,
  required = true,
): string | null {
  const d = sanitizeMobileDigits(digits);
  if (!d) {
    return required
      ? "Please enter all 8 digits of your mobile number. (0/8 entered)"
      : null;
  }
  if (d.length !== 8) {
    return `Please enter all 8 digits of your mobile number. (${d.length}/8 entered)`;
  }
  return null;
}

/**
 * Address validation with a specific incompleteness message (Bug #19).
 * Returns null when acceptable. Intentionally lenient: any multi-word entry
 * (e.g. "1 Castlereagh St") passes.
 */
export function addressValidationError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Address is required";
  if (v.split(/\s+/).length < 2) {
    return "Address looks incomplete — include at least street and suburb";
  }
  return null;
}

export function sanitizeAbn(value: string): string {
  return digitsOnly(value).slice(0, 11);
}

export function isValidAbn(value: string): boolean {
  return /^\d{11}$/.test(digitsOnly(value));
}

/** "12345678901" -> "12 345 678 901". */
export function formatAbn(value: string): string {
  const d = sanitizeAbn(value);
  if (d.length !== 11) return d;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

export function sanitizeAcn(value: string): string {
  return digitsOnly(value).slice(0, 9);
}

export function isValidAcn(value: string): boolean {
  return /^\d{9}$/.test(digitsOnly(value));
}

/** "123456789" -> "123 456 789". */
export function formatAcn(value: string): string {
  const d = sanitizeAcn(value);
  if (d.length !== 9) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}
