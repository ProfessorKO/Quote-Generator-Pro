/**
 * Explicit allowlist of trusted front-end origins, derived from environment
 * configuration. Never reflect the request's Origin header — that would let
 * any site make credentialed cross-origin calls (CSRF-style data theft) and
 * poison Stripe redirect URLs (open redirect).
 */
function computeAllowedOrigins(): string[] {
  const origins = new Set<string>();

  for (const domain of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const trimmed = domain.trim();
    if (trimmed) origins.add(`https://${trimmed}`);
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) origins.add(`https://${devDomain}`);

  return Array.from(origins);
}

export const allowedOrigins: string[] = computeAllowedOrigins();

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !!origin && allowedOrigins.includes(origin);
}

/** Canonical app base URL for server-constructed links (e.g. Stripe redirects). */
export function appBaseUrl(): string {
  if (allowedOrigins.length === 0) {
    throw new Error(
      "No trusted app origins configured (REPLIT_DOMAINS / REPLIT_DEV_DOMAIN missing)",
    );
  }
  return allowedOrigins[0];
}
