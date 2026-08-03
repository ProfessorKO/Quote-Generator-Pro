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

// Resend's default test sender. In development we always send from this
// address (no domain verification needed). Note: Resend testing mode only
// delivers to the email address registered on the Resend account.
const RESEND_TEST_FROM = "onboarding@resend.dev";

// The connectors SDK's listConnections does NOT return credential settings
// (from_email lives in secrets). Fetch them from the Replit credential proxy,
// which is the canonical source for connection settings server-side.
async function getFromEmail(): Promise<string> {
  if (process.env.NODE_ENV !== "production") {
    return RESEND_TEST_FROM;
  }
  // Preferred: explicit branded sender (e.g. quotemate@workmatespro.com.au),
  // set once the domain is verified in Resend. Falls back to the connector's
  // configured from_email.
  if (process.env.QUOTE_FROM_EMAIL) {
    return process.env.QUOTE_FROM_EMAIL;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new SendQuoteEmailError(
      "config",
      "Replit connector environment is unavailable (missing hostname or identity token)",
    );
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
  );
  if (!response.ok) {
    throw new SendQuoteEmailError(
      "config",
      `Failed to fetch Resend connection settings (${response.status})`,
    );
  }

  const data = (await response.json()) as {
    items?: Array<{ settings?: Record<string, unknown> }>;
  };
  const fromEmail = data.items?.[0]?.settings?.from_email;
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
  // Sender-side setup problems (unverified domain, testing-mode restriction)
  // are config errors, not recipient errors. Resend returns 403 with messages
  // like "The <domain> domain is not verified" or "You can only send testing
  // emails to your own email address".
  if (
    lower.includes("not verified") ||
    lower.includes("verify a domain") ||
    lower.includes("testing emails")
  ) {
    return new SendQuoteEmailError(
      "config",
      `Resend sender not verified (${status}): ${detail.slice(0, 300)}`,
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
  const fromEmail = await getFromEmail();

  const body: Record<string, unknown> = {
    from: `Quote Mate <${fromEmail}>`,
    // Replies from customers should land in the support inbox, not bounce.
    reply_to: process.env.QUOTE_REPLY_TO_EMAIL ?? "support@workmatespro.com.au",
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
