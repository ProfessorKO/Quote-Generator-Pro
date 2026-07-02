// Resend email sending via the Replit connector proxy (integration: resend).
// The @replit/connectors-sdk handles identity, token refresh, and auth headers.
// Never cache the client — tokens expire; construct it per request.
import { ReplitConnectors } from "@replit/connectors-sdk";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment?: { filename: string; contentBase64: string };
}

/**
 * Error thrown when sending fails, carrying a client-safe reason so the route
 * can return a helpful message (Bug #24).
 */
export type SendFailureReason =
  | "config" // missing/misconfigured Resend connection (from_email etc.)
  | "invalid_recipient" // Resend rejected the client email address
  | "rate_limited" // Resend throttled us
  | "unknown"; // anything else — safe to retry

export class SendQuoteEmailError extends Error {
  reason: SendFailureReason;
  status?: number;
  constructor(reason: SendFailureReason, message: string, status?: number) {
    super(message);
    this.name = "SendQuoteEmailError";
    this.reason = reason;
    this.status = status;
  }
}

async function getFromEmail(connectors: ReplitConnectors): Promise<string> {
  const connections = await connectors.listConnections({
    connector_names: "resend",
  });
  const settings = (connections[0] as { settings?: Record<string, unknown> })
    ?.settings;
  const fromEmail = settings?.from_email;
  if (typeof fromEmail !== "string" || !fromEmail) {
    throw new SendQuoteEmailError(
      "config",
      "Resend connection is missing a verified from_email",
    );
  }
  return fromEmail;
}

/** Classify a Resend HTTP failure into a client-safe reason. */
function classifyResendFailure(
  status: number,
  detail: string,
): SendQuoteEmailError {
  const lower = detail.toLowerCase();
  if (status === 429) {
    return new SendQuoteEmailError(
      "rate_limited",
      `Resend rate limited (${status}): ${detail.slice(0, 300)}`,
      status,
    );
  }
  // Resend uses 422 for validation errors (e.g. an invalid "to" address).
  if (
    status === 422 ||
    (status >= 400 &&
      status < 500 &&
      (lower.includes("invalid") ||
        lower.includes("email") ||
        lower.includes("validation")))
  ) {
    return new SendQuoteEmailError(
      "invalid_recipient",
      `Resend rejected the recipient (${status}): ${detail.slice(0, 300)}`,
      status,
    );
  }
  return new SendQuoteEmailError(
    "unknown",
    `Resend send failed (${status}): ${detail.slice(0, 300)}`,
    status,
  );
}

export async function sendQuoteEmail(params: SendEmailParams): Promise<void> {
  const connectors = new ReplitConnectors();
  const fromEmail = await getFromEmail(connectors);

  const body: Record<string, unknown> = {
    from: `QuoteCraft <${fromEmail}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  };

  if (params.attachment) {
    body.attachments = [
      {
        filename: params.attachment.filename,
        content: params.attachment.contentBase64,
      },
    ];
  }

  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw classifyResendFailure(response.status, detail);
  }
}
