import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { email: string };
    }
  }
}

// Retrieve configured admin credentials from environment variables (Coolify / .env)
export function getAdminEmail(): string {
  return (process.env.AUTH_EMAIL || process.env.ADMIN_EMAIL || 'admin@admin.com').trim().toLowerCase();
}

export function getAdminPassword(): string {
  return process.env.AUTH_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123';
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'omnibot_secure_jwt_secret_key_oracle_2026';
}

/**
 * Constant-time password comparison to prevent timing attacks.
 */
export function verifyPassword(providedPassword: string): boolean {
  const expectedPassword = getAdminPassword();
  const providedHash = crypto.createHash('sha256').update(providedPassword).digest();
  const expectedHash = crypto.createHash('sha256').update(expectedPassword).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

/**
 * Validate user credentials against .env variables.
 */
export function validateCredentials(email: string, password: string): boolean {
  if (!email || !password) return false;
  const isEmailValid = email.trim().toLowerCase() === getAdminEmail();
  const isPasswordValid = verifyPassword(password);
  return isEmailValid && isPasswordValid;
}

/**
 * Base64 URL encode utility
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64 URL decode utility
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export interface TokenPayload {
  email: string;
  iat: number;
  exp: number;
}

/**
 * Generate a cryptographically signed HMAC-SHA256 session token (valid for 7 days)
 */
export function generateToken(email: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  const payload: TokenPayload = {
    email: email.trim().toLowerCase(),
    iat: now,
    exp: now + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 session token
 */
export function verifyToken(token: string | null | undefined): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    // Verify expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    // Verify configured user matches
    if (payload.email !== getAdminEmail()) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware: Protect routes and reject unauthorized requests
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Extract token from Authorization header: "Bearer <token>"
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Acceso no autorizado. Inicie sesión para continuar.',
      authenticated: false,
    });
    return;
  }

  req.user = { email: payload.email };
  next();
}

/**
 * WebSocket token verification helper
 */
export function verifyWsToken(token: string | undefined): boolean {
  if (!token) return false;
  return verifyToken(token) !== null;
}
