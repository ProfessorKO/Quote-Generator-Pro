import { Router, type IRouter } from "express";
import { z } from "zod";
import { createAnonRateLimiter } from "../lib/anonRateLimit";
import { sendQuoteEmail, SendQuoteEmailError } from "../lib/resend";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPPORT_EMAIL = "support@workmatespro.com.au";

// Contact form is public (works for visitors and signed-in users alike), so
// throttle by IP to keep the support inbox from being spammed.
const contactRateLimiter = createAnonRateLimiter({
  max: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

const ContactBody = z.object({
  // Normalize any CR/LF to spaces — name is interpolated into the email
  // subject, and a public endpoint must not allow header injection.
  name: z
    .string()
    .transform((v) => v.replace(/[\r\n]+/g, " ").trim())
    .pipe(z.string().min(1, "Name is required").max(100)),
  email: z.string().trim().email("A valid email is required").max(200),
  // Optional AU mobile: the client sends only the digits after the fixed
  // +61-04 prefix — exactly 8 of them, or omitted entirely.
  mobile: z
    .string()
    .regex(/^\d{8}$/, "Mobile must be exactly 8 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  message: z.string().trim().min(1, "Message is required").max(500),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.post("/contact", contactRateLimiter, async (req, res): Promise<void> => {
  const parsed = ContactBody.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: first?.message ?? "Invalid input" });
    return;
  }

  const { name, email, mobile, message } = parsed.data;
  const mobileDisplay = mobile ? `+61-04${mobile}` : "Not provided";

  const text = [
    `New contact form submission from Quote Mate`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    `Mobile: ${mobileDisplay}`,
    ``,
    `Message:`,
    message,
  ].join("\n");

  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Mobile:</strong> ${escapeHtml(mobileDisplay)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    await sendQuoteEmail({
      to: SUPPORT_EMAIL,
      subject: `Contact form: ${name}`,
      html,
      text,
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Contact form send failed");
    const status =
      error instanceof SendQuoteEmailError && error.reason === "rate_limited"
        ? 429
        : 502;
    res.status(status).json({
      error: "Couldn't send your message right now. Please try again shortly.",
    });
  }
});

export default router;
