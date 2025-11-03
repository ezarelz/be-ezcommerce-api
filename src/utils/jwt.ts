// src/utils/jwt.ts
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { CustomJwtPayload } from '../types/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

/** Tipe aman untuk expiresIn (mengikuti jsonwebtoken) */
type Expires = NonNullable<SignOptions['expiresIn']>;

/** Helper: baca expiry dari ENV (optional) */
const DEFAULT_EXPIRES: Expires =
  (process.env.JWT_EXPIRES_IN as Expires) || '7d';

/** Sign token (typed, aman untuk TS) */
export function signToken<T extends object>(
  payload: T,
  expiresIn: Expires = DEFAULT_EXPIRES
): string {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, options);
}

/** Verify token → payload atau null (tanpa melempar error) */
export function verifyToken<T extends JwtPayload>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}

/** Ambil token dari header Authorization: "Bearer <token>" */
export function extractToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** Shortcut khusus kalau payload kamu adalah CustomJwtPayload */
export function verifyUserToken(token: string): CustomJwtPayload | null {
  return verifyToken<CustomJwtPayload>(token);
}
