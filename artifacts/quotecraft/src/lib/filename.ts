// PDF filename conventions (Enhancement #28).
//   Downloaded: Quote_{BusinessName}_Download_{DownloadDate}_###
//   Emailed:    Quote_{BusinessName}_{ClientName}_###
// Sequence numbers are per-user, per-year (reset to 001 each year) and come
// from the /quotes/next-sequence endpoint.

export const MAX_FILENAME_CHARS = 80;

/** Remove special characters, replace spaces with underscores, cap length. */
export function sanitizePdfFilename(name: string): string {
  return name
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, MAX_FILENAME_CHARS);
}

export function filenameValidationError(name: string): string | null {
  if (!name.trim()) return "Filename is required";
  if (name.trim().length > MAX_FILENAME_CHARS)
    return `Filename must be ${MAX_FILENAME_CHARS} characters or fewer`;
  if (!sanitizePdfFilename(name))
    return "Filename must contain letters or numbers";
  return null;
}

export function isoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// Bug #32 — the reference printed on the PDF header: YYYY-MM-DD_### (### is the
// per-user, per-year sequence). Replaces the old free-text description/label.
export function buildQuoteNumber(
  sequence: string,
  date: Date = new Date(),
): string {
  return `${isoDate(date)}_${sequence || "001"}`;
}

export function buildDownloadFilename(
  businessName: string,
  sequence: string,
  date: Date = new Date(),
): string {
  return sanitizePdfFilename(
    `Quote_${businessName || "Business"}_Download_${isoDate(date)}_${sequence || "001"}`,
  );
}

export function buildEmailFilename(
  businessName: string,
  clientName: string,
  sequence: string,
): string {
  return sanitizePdfFilename(
    `Quote_${businessName || "Business"}_${clientName || "Client"}_${sequence || "001"}`,
  );
}
