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

async function getFromEmail(connectors: ReplitConnectors): Promise<string> {
  const connections = await connectors.listConnections({
    connector_names: "resend",
  });
  const settings = (connections[0] as { settings?: Record<string, unknown> })
    ?.settings;
  const fromEmail = settings?.from_email;
  if (typeof fromEmail !== "string" || !fromEmail) {
    throw new Error("Resend connection is missing a verified from_email");
  }
  return fromEmail;
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
    throw new Error(
      `Resend send failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}
