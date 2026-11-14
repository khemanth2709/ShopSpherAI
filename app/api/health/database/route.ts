import { NextResponse } from 'next/server';
import { db, databaseFilePath } from '@/lib/database/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const integrity = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    const products = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active = 1').get() as { count: number };
    const users = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    const ok = integrity.quick_check === 'ok' && foreignKeys.length === 0;
    return NextResponse.json({
      ok, database: 'SQLite', integrity: integrity.quick_check, foreignKeyViolations: foreignKeys.length,
      activeProducts: products.count, users: users.count,
      file: process.env.NODE_ENV === 'development' ? databaseFilePath.split(/[\\/]/).slice(-2).join('/') : 'local database',
    }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ ok: false, database: 'SQLite', message: error instanceof Error ? error.message : 'Database health check failed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
