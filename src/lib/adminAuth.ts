import { timingSafeEqual } from 'node:crypto';
import { verifyAuth, type AuthResult } from './apiAuth';

export type AdminAuthResult = {
  auth: AuthResult | null;
  via: 'admin-key' | 'allowlist';
};

function splitEnvList(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAdminKeys() {
  return [
    ...splitEnvList(process.env.ADMIN_API_KEY),
    ...splitEnvList(process.env.CHARISHUB_ADMIN_KEY),
    ...splitEnvList(process.env.ADMIN_PANEL_KEY),
  ];
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidAdminKey(req: Request) {
  const provided = req.headers.get('x-admin-key')?.trim();
  if (!provided) return false;
  return getAdminKeys().some((key) => safeEqual(provided, key));
}

function isAllowListed(auth: AuthResult | null) {
  if (!auth) return false;
  const userIds = splitEnvList(process.env.ADMIN_USER_IDS);
  const emails = splitEnvList(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase());
  return userIds.includes(auth.userId) || (!!auth.email && emails.includes(auth.email.toLowerCase()));
}

export async function verifyAdmin(req: Request): Promise<AdminAuthResult | null> {
  if (hasValidAdminKey(req)) {
    return { auth: null, via: 'admin-key' };
  }

  const auth = await verifyAuth(req);
  if (isAllowListed(auth)) {
    return { auth, via: 'allowlist' };
  }

  return null;
}

