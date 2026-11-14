import 'server-only';
import { cookies } from 'next/headers';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '@/lib/database/db';
import { getUserFromSession, revokeSession, signIn, createAccount, SESSION_COOKIE } from '@/lib/database/auth';
import { executeQuery, LocalQueryBuilder, type QuerySpec } from '@/lib/database/query';
import { executeRpc } from '@/lib/database/rpc';

function dbError(error: unknown) {
  const cause = error as { message?: string; code?: string };
  return { message: cause?.message || 'Database operation failed.', code: cause?.code || 'SQLITE_ERROR' };
}

async function storeFile(filePath: string, data: Uint8Array) {
  const safe = filePath.replaceAll('\\','/').replace(/^\/+/, '');
  if (!safe || safe.split('/').some((part) => part === '..' || part === '.')) throw new Error('Invalid upload path.');
  const optimizedPath = safe.replace(/\.(?:jpe?g|png|webp)$/i, '.webp');
  const base = path.join(process.cwd(), 'public', 'uploads', 'product-images');
  const absolute = path.join(base, optimizedPath);
  if (!absolute.startsWith(base + path.sep)) throw new Error('Invalid upload path.');
  const optimized = await sharp(Buffer.from(data), { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, optimized);
  return optimizedPath;
}

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const user = getUserFromSession(token);
  const execute = async (spec: QuerySpec) => {
    try { return { ...executeQuery(spec, user), error: null }; }
    catch (error) { return { data: null, error: dbError(error) }; }
  };
  const client = {
    auth: {
      async getUser() { return { data: { user }, error: null }; },
      async getSession() { return { data: { session: user ? { user } : null }, error: null }; },
      async signInWithPassword(input: { email: string; password: string }) {
        try {
          const result = signIn(input.email, input.password);
          cookieStore.set(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
          return { data: { user: result.user, session: { user: result.user } }, error: null };
        } catch (error) { return { data: { user: null, session: null }, error: dbError(error) }; }
      },
      async signUp(input: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
        try {
          const created = createAccount({ name: input.options?.data?.full_name || input.email.split('@')[0], email: input.email, password: input.password });
          const result = signIn(input.email, input.password);
          cookieStore.set(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
          return { data: { user: created, session: { user: created } }, error: null };
        } catch (error) { return { data: { user: null, session: null }, error: dbError(error) }; }
      },
      async signOut() { revokeSession(token); cookieStore.delete(SESSION_COOKIE); return { error: null }; },
      async resetPasswordForEmail() { return { error: { message: 'Use the ShopSphere password recovery link.' } }; },
      async updateUser(input: { password: string }) {
        if (!user) return { error: { message: 'Your session has expired. Sign in again.' } };
        const { scryptSync } = await import('node:crypto');
        const { randomBytes } = await import('node:crypto');
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync(input.password, salt, 64).toString('hex');
        db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(`scrypt$${salt}$${hash}`, new Date().toISOString(), user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        cookieStore.delete(SESSION_COOKIE);
        return { error: null };
      },
      onAuthStateChange(_callback: (event: string, session: unknown) => void) {
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from(table: string) { return new LocalQueryBuilder(table, execute); },
    async rpc(name: string, args: Record<string, unknown> = {}) {
      try { return { data: executeRpc(name, args, user), error: null }; }
      catch (error) { return { data: null, error: dbError(error) }; }
    },
    storage: {
      from(bucket: string) {
        if (bucket !== 'product-images') throw new Error('Unknown storage bucket.');
        return {
          async upload(filePath: string, file: Uint8Array | ArrayBuffer, options?: { contentType?: string }) {
            if (user?.profile?.role !== 'admin') return { data: null, error: { message: 'Administrator access is required.' } };
            try {
              const bytes = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
              const pathValue = await storeFile(filePath, bytes);
              return { data: { path: pathValue }, error: null };
            } catch (error) { return { data: null, error: dbError(error) }; }
          },
          getPublicUrl(filePath: string) { return { data: { publicUrl: `/uploads/product-images/${filePath.replace(/^\/+/, '')}` } }; },
          async remove(paths: string[]) {
            for (const filePath of paths) {
              const safe = filePath.replaceAll('\\','/').replace(/^\/+/, '');
              if (safe.split('/').some((part) => part === '..')) continue;
              await unlink(path.join(process.cwd(), 'public', 'uploads', 'product-images', safe)).catch(() => undefined);
            }
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
    channel(_name?: string) { const channel = { on(_event: string, _config: unknown, _callback?: (payload: unknown) => void) { return channel; }, subscribe() { return channel; }, unsubscribe() { return 'ok'; } }; return channel; },
    async removeChannel(channel?: { unsubscribe?: () => unknown }) { return channel?.unsubscribe?.() ?? 'ok'; },
  };
  return client;
}
