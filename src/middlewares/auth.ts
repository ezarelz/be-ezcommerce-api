import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

/**
 * Extends the Express request object to include an optional `user` field. When
 * authentication is successful the middleware sets `req.user` with the
 * decoded payload, typically containing `userId` and optional role flags.
 */
export interface AuthRequest extends Request {
  user?: { userId: number; isSeller?: boolean };
}

/**
 * Authentication middleware that verifies the presence and validity of a
 * Bearer token in the Authorization header. If verification succeeds the
 * decoded payload is attached to `req.user`; otherwise a 401 response is
 * returned.
 *
 * Usage: apply this middleware on routes that require authentication.
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.replace(/^[Bb]earer\s+/, '');
  try {
    const payload = verifyToken<any>(token);
    req.user = { userId: payload.userId, isSeller: payload.isSeller };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}