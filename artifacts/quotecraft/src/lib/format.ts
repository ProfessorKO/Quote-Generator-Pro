// AU business-profile formatting & validation helpers.
// Mobile is always an Australian mobile: a fixed "+61 4" prefix plus 8 user
// digits, stored as "+61 4 XXXX XXXX".

export const MOBILE_PREFIX_DISPLAY = "+61-4";

/** Keep only digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** The 8 digits the user types (after the leading "+61 4"). Max 8. */
export function sanitizeMobileDigits(value: string): string {
  return digitsOnly(value).slice(0, 8);
}

export function isValidMobileDigits(eightDigits: string): boolean {
  return /^\d{8}$/.test(eightDigits);
}

/** "12345678" -> "+61 4 1234 5678". Empty input -> "". */
export function formatStoredMobile(eightDigits: string): string {
  const d = sanitizeMobileDigits(eightDigits);
  if (!d) return "";
  const left = d.slice(0, 4);
  const right = d.slice(4, 8);
  return `+61 4 ${left}${right ? " " + right : ""}`.trim();
}

/** Extract the 8 user digits from a stored "+61 4 XXXX XXXX" value. */
export function mobileDigitsFromStored(stored: string | null | undefined): string {
  if (!stored) return "";
  const all = digitsOnly(stored); // e.g. 61412345678
  // Drop the country code 61 and the leading 4, keep the last 8.
  if (all.startsWith("614")) return all.slice(3, 11);
  if (all.startsWith("61")) return all.slice(2).replace(/^4/, "").slice(0, 8);
  return all.replace(/^4/, "").slice(0, 8);
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
