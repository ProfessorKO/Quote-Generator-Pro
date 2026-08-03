/**
 * Integration test for the anonymous AI rate limiter (task: rate-limit bypass
 * on AI endpoints). Boots a real Express app configured exactly like the API
 * server ("trust proxy" = 1, limiter after optional auth) and verifies:
 *  - distinct real client IPs get isolated buckets
 *  - forged X-Forwarded-For values from the client CANNOT change the bucket
 *  - 31st anonymous request returns 429 with Retry-After
 *  - authenticated requests bypass the limiter (billing meters them instead)
 *  - two endpoints sharing the limiter share the budget
 *
 * Run: ../../scripts/node_modules/.bin/tsx src/test/anon-rate-limit-e2e.ts
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { createAnonRateLimiter } from "../lib/anonRateLimit";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const limiter = createAnonRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

  const app = express();
  // Mirrors app.ts: trust exactly one hop, so req.ip comes from the RIGHTMOST
  // X-Forwarded-For entry (appended by the trusted proxy), never from values
  // a client prepends itself.
  app.set("trust proxy", 1);
  // Simulated optional auth: header-driven for the test.
  app.use((req, _res, next) => {
    const uid = req.header("x-test-user");
    if (uid) (req as any).userId = uid;
    next();
  });
  app.post("/a", limiter, (_req, res) => void res.json({ ok: true }));
  app.post("/b", limiter, (_req, res) => void res.json({ ok: true }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  const post = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: "POST", headers });

  // In this test the direct socket peer plays the role of the trusted proxy,
  // so with trust proxy=1 the rightmost XFF entry is treated as the client IP.
  const asClient = (ip: string, extra: Record<string, string> = {}) => ({
    "X-Forwarded-For": extra["X-Forwarded-For"]
      ? `${extra["X-Forwarded-For"]}, ${ip}`
      : ip,
  });

  // 1) Forged XFF cannot mint fresh buckets: client behind "proxy IP" 10.0.0.1
  // prepends a unique fake IP on every request — must still hit 429 at 31.
  let last: Response | null = null;
  for (let i = 1; i <= 31; i++) {
    last = await post("/a", asClient("10.0.0.1", { "X-Forwarded-For": `1.2.3.${i}` }));
  }
  check("forged XFF does not bypass limit (31st = 429)", last!.status === 429);
  check("429 includes Retry-After", !!last!.headers.get("retry-after"));

  // 2) A distinct real client IP is isolated — still allowed.
  const other = await post("/a", asClient("10.0.0.2"));
  check("distinct real client IP has its own bucket", other.status === 200);

  // 3) Shared budget across both endpoints: exhausted IP is blocked on /b too.
  const b = await post("/b", asClient("10.0.0.1"));
  check("limiter budget shared across endpoints", b.status === 429);

  // 4) Authenticated callers bypass the anonymous limiter.
  const authed = await post("/a", { ...asClient("10.0.0.1"), "x-test-user": "user_1" });
  check("authenticated user bypasses anon limiter", authed.status === 200);

  // 5) Sanity: exactly 30 anonymous requests succeed for a fresh IP.
  limiter.reset();
  let okCount = 0;
  for (let i = 1; i <= 31; i++) {
    const r = await post("/a", asClient("10.0.0.9"));
    if (r.status === 200) okCount++;
  }
  check("exactly 30 requests allowed per window", okCount === 30);

  server.close();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
