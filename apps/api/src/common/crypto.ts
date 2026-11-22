import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Secrets that an admin types into the settings page (SMTP password, push private key) are stored encrypted.
// The key comes from SETTINGS_ENCRYPTION_KEY. If it is missing we derive one from JWT_ACCESS_SECRET, so a deployment
// still works, but then changing that secret makes the stored secrets unreadable (the admin has to enter them again).
const key = () => createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || 'dev-only-key').digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(blob?: string | null): string | undefined {
  if (!blob) return undefined;
  try {
    const [v, iv, tag, data] = blob.split(':');
    if (v !== 'v1') return undefined;
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return undefined; // wrong key or damaged value
  }
}
