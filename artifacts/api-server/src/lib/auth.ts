import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * Attaches userId when a valid session exists, but never rejects the
 * request. Used by endpoints that visitors may call anonymously
 * (e.g. quote generation) — billing/metering only applies when a
 * userId is present.
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (userId) {
    (req as AuthedRequest).userId = userId as string;
  }
  next();
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId as string;
  next();
};
