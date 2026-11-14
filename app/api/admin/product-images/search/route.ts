import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OpenverseImage = {
  id?: string; title?: string; creator?: string; creator_url?: string; url?: string;
  thumbnail?: string; license?: string; license_version?: string; license_url?: string;
  foreign_landing_url?: string; attribution?: string; width?: number; height?: number;
};

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' ? parsed.toString() : null; }
  catch { return null; }
}

export async function GET(request: Request) {
  const database = await createClient();
  const { data: { user }, error: authError } = await database.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in with an administrator account to search product photographs.' }, { status: 401 });

  const { data: profile, error: profileError } = await database.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return NextResponse.json({ error: 'Only ShopSphere administrators can search and assign catalogue photographs.' }, { status: 403 });

  const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 140);
  if (query.length < 3) return NextResponse.json({ error: 'Enter at least three characters to search for a product photograph.' }, { status: 400 });

  const endpoint = new URL('https://api.openverse.org/v1/images/');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('page_size', '12');
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('license_type', 'commercial');
  endpoint.searchParams.set('category', 'photograph');
  endpoint.searchParams.set('size', 'large');
  endpoint.searchParams.set('extension', 'jpg,jpeg,png,webp');
  endpoint.searchParams.set('mature', 'false');

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 1800 },
    });
    if (!response.ok) {
      const message = response.status === 429
        ? 'The free image search is temporarily rate-limited. Wait a minute and try again.'
        : `Image search provider returned HTTP ${response.status}. Please retry later.`;
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 });
    }
    const payload = await response.json() as { results?: OpenverseImage[] };
    const results = (payload.results || []).flatMap((item) => {
      const url = safeHttpsUrl(item.url);
      const thumbnail = safeHttpsUrl(item.thumbnail);
      const sourceUrl = safeHttpsUrl(item.foreign_landing_url);
      if (!url || !thumbnail || !sourceUrl) return [];
      return [{
        id: String(item.id || url), title: String(item.title || 'Untitled photograph').slice(0, 180),
        creator: String(item.creator || 'Unknown creator').slice(0, 120), creatorUrl: safeHttpsUrl(item.creator_url),
        url, thumbnail, sourceUrl, license: String(item.license || 'See source').toUpperCase(),
        licenseVersion: String(item.license_version || ''), licenseUrl: safeHttpsUrl(item.license_url),
        attribution: String(item.attribution || '').slice(0, 500), width: Number(item.width || 0), height: Number(item.height || 0),
      }];
    });
    return NextResponse.json({ query, results });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Image search timed out. Check your connection and try again.'
      : 'Could not reach the open-licence image search. Please try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
