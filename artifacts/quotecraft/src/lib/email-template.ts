export const DEFAULT_EMAIL_SUBJECT = "Your quote from {{businessName}}";

export const DEFAULT_EMAIL_BODY = `Hi {{clientName}},

Thanks for the opportunity to quote on your job. Please find your quote attached — the total is {{quoteTotal}}.

If you have any questions or would like to go ahead, just reply to this email.

Kind regards,
{{businessName}}`;

export interface EmailPlaceholders {
  clientName: string;
  businessName: string;
  quoteTotal: string;
}

export function applyEmailPlaceholders(
  text: string,
  values: EmailPlaceholders,
): string {
  return text
    .replace(/\{\{\s*clientName\s*\}\}/g, values.clientName || "there")
    .replace(/\{\{\s*businessName\s*\}\}/g, values.businessName || "")
    .replace(/\{\{\s*quoteTotal\s*\}\}/g, values.quoteTotal || "");
}
