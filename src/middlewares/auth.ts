import type { Request, Response, NextFunction } from 'express';
import prisma from '../libs/prisma';
import { verifyToken } from '../utils/jwt';

/** JWT payload structure */
export interface JWTPayload {
  userId: number | string;
  isSeller?: boolean;
  iat?: number;
  exp?: number;
}

/** Custom request type used in routes for strong typing */
export interface AuthRequest extends Request {
  user?: JWTPayload;
  shop?: any;
}

/** Extract Bearer token safely */
function extractBearerToken(headerValue?: string): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.trim().split(/\s+/, 2);
  if (!/^bearer$/i.test(scheme)) return null;
  if (!token || ['null', 'undefined', ''].includes(token.trim())) return null;
  return token.trim();
}

/** ✅ Authentication middleware */
export function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res
      .status(401)
      .json({ success: false, message: 'Unauthorized: Missing token' });
    return;
  }

  const payload = verifyToken<JWTPayload>(token);

  if (!payload || typeof payload !== 'object' || !payload.userId) {
    res
      .status(401)
      .json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  req.user = {
    userId: Number(payload.userId),
    isSeller: payload.isSeller ?? false,
    iat: payload.iat,
    exp: payload.exp,
  };

  next();
}

/** ✅ Require seller middleware */
export async function requireSeller(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      res
        .status(401)
        .json({ success: false, message: 'Unauthorized: Missing user ID' });
      return;
    }

    const shop = await prisma.shop.findFirst({
      where: { userId: Number(req.user.userId) },
    });

    if (!shop) {
      res.status(403).json({
        success: false,
        message: 'Seller access required (no shop found for this user)',
      });
      return;
    }

    req.shop = shop;
    next();
  } catch (err) {
    console.error('[requireSeller] Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

/** Aliases & exports */
export const authenticate = authenticateUser;
export default authenticateUser;
