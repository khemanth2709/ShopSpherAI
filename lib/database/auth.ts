import 'server-only';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, newId, nowIso } from '@/lib/database/db';

export type LocalUser = { id: string; email: string; user_metadata: { full_name: string }; profile?: { full_name: string; role: 'customer' | 'admin' } };
const SESSION_COOKIE = 'shopsphere_session';
const SESSION_TTL_DAYS = 7;

function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(password: string, stored: string) {
  const [kind, salt, expectedHex] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Set a valid ADMIN_EMAIL in .env.local.');
  }
  if (email === 'admin@example.com' || password.startsWith('REPLACE_WITH_') || password.startsWith('CHANGE_THIS')) {
    throw new Error('Replace the example administrator email and password in .env.local before starting ShopSphere.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain between 12 and 128 characters.');
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE profiles SET role = 'admin' WHERE id = ?").run(existing.id);
    return;
  }
  const id = newId();
  const insertUser = db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)');
  const insertProfile = db.prepare("INSERT INTO profiles (id,full_name,role) VALUES (?,?, 'admin')");
  db.transaction(() => {
    insertUser.run(id, email, passwordHash(password));
    insertProfile.run(id, email.split('@')[0]);
  })();
}

export function createAccount(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 100) throw new Error('Enter a name between 2 and 100 characters.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (input.password.length < 8 || input.password.length > 128 || !/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
    throw new Error('Use at least 8 characters, including a letter and a number.');
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new Error('An account with this email already exists.');
  const id = newId();
  db.transaction(() => {
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').run(id, email, passwordHash(input.password));
    db.prepare("INSERT INTO profiles (id,full_name,role) VALUES (?,?, 'customer')").run(id, name);
  })();
  return getUserById(id);
}

export function getUserById(id: string): LocalUser | null {
  const row = db.prepare(`SELECT u.id,u.email,p.full_name,p.role FROM users u JOIN profiles p ON p.id=u.id WHERE u.id=?`).get(id) as { id: string; email: string; full_name: string; role: 'customer' | 'admin' } | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, user_metadata: { full_name: row.full_name }, profile: { full_name: row.full_name, role: row.role } };
}

export function signIn(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  if (email.length > 254 || password.length > 128) throw new Error('Invalid email or password.');
  const row = db.prepare('SELECT id,email,password_hash FROM users WHERE email=?').get(email) as { id: string; email: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) throw new Error('Invalid email or password.');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(tokenHash(token), row.id, expiresAt);
  return { token, user: getUserById(row.id) };
}

export function getUserFromSession(token?: string | null): LocalUser | null {
  if (!token) return null;
  const row = db.prepare(`SELECT s.user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash(token), nowIso()) as { user_id: string } | undefined;
  if (!row) return null;
  return getUserById(row.user_id);
}

export function revokeSession(token?: string | null) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
}

export function createPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(email) as { id: string } | undefined;
  // Always return a neutral response to avoid account enumeration.
  if (!user) return null;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  db.prepare('DELETE FROM password_resets WHERE user_id=? OR expires_at<=?').run(user.id, nowIso());
  db.prepare('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)').run(tokenHash(token), user.id, expiresAt);
  return token;
}

export function confirmPasswordReset(token: string, password: string) {
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Use 8 to 128 characters, including a letter and a number.');
  const row = db.prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>? AND used_at IS NULL').get(tokenHash(token), nowIso()) as { user_id: string } | undefined;
  if (!row) throw new Error('This password-reset link is invalid or expired.');
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash=?, updated_at=? WHERE id=?').run(passwordHash(password), nowIso(), row.user_id);
    db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').run(nowIso(), tokenHash(token));
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
  })();
}

export { SESSION_COOKIE, tokenHash };

// Creates/promotes the one configured bootstrap administrator; public registration can never create admins.
ensureBootstrapAdmin();

export function isPasswordResetTokenValid(token: string) {
  const row = db.prepare('SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>? AND used_at IS NULL').get(tokenHash(token), nowIso());
  return Boolean(row);
}
