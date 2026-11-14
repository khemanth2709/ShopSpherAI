import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const COMMERCIAL_LICENSES = new Set(['by', 'by-sa', 'by-nd', 'cc0', 'pdm']);

type OpenverseDetail = {
  id?: string;
  title?: string;
  creator?: string;
  creator_url?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
};

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '127.0.0.1' || hostname === '::1') return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readImageWithinLimit(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('The selected photo is larger than 5 MB. Choose a smaller image.');
  if (!response.body) throw new Error('The photo provider returned an empty image.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('The selected photo is larger than 5 MB. Choose a smaller image.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function POST(request: Request) {
  const database = await createClient();
  const { data: { user }, error: authError } = await database.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in with an administrator account to assign product photographs.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await database
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only ShopSphere administrators can assign product photographs.' }, { status: 403 });
  }

  let body: { productId?: unknown; imageId?: unknown };
  try {
    body = await request.json() as { productId?: unknown; imageId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const imageId = typeof body.imageId === 'string' ? body.imageId.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(productId)) {
    return NextResponse.json({ error: 'Choose a valid catalogue product.' }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(imageId)) {
    return NextResponse.json({ error: 'The selected Openverse image ID is invalid.' }, { status: 400 });
  }

  const { data: product, error: productError } = await database
    .from('products').select('id,name').eq('id', productId).eq('is_active', true).maybeSingle();
  if (productError || !product) {
    return NextResponse.json({ error: 'The selected product was not found or is no longer active.' }, { status: 404 });
  }

  let storagePath = '';
  try {
    const detailResponse = await fetch(`https://api.openverse.org/v1/images/${imageId}/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!detailResponse.ok) throw new Error('Could not verify the selected photograph with Openverse. Search again and choose another result.');

    const detail = await detailResponse.json() as OpenverseDetail;
    const license = String(detail.license || '').toLowerCase();
    if (!COMMERCIAL_LICENSES.has(license)) {
      throw new Error('This photograph does not have a licence marked for commercial use. Choose another result.');
    }

    const imageUrl = safeHttpsUrl(detail.url);
    const sourceUrl = safeHttpsUrl(detail.foreign_landing_url);
    const licenseUrl = safeHttpsUrl(detail.license_url);
    if (!imageUrl || !sourceUrl || !licenseUrl) throw new Error('The photograph is missing a valid HTTPS source or licence URL.');

    const thumbnailUrl = safeHttpsUrl(detail.thumbnail);
    const requestImage = (url: string) => fetch(url, {
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
      redirect: 'follow',
    });
    let imageResponse = await requestImage(thumbnailUrl || imageUrl);
    if ((!imageResponse.ok || !safeHttpsUrl(imageResponse.url)) && thumbnailUrl && thumbnailUrl !== imageUrl) {
      imageResponse = await requestImage(imageUrl);
    }
    if (!imageResponse.ok || !safeHttpsUrl(imageResponse.url)) {
      throw new Error('The image host could not provide this photograph over a safe HTTPS connection. Choose another result.');
    }

    const contentType = (imageResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = extensions[contentType];
    if (!extension) throw new Error('Only JPG, PNG and WebP photographs can be assigned. Choose another result.');

    const bytes = await readImageWithinLimit(imageResponse);
    if (!bytes.byteLength) throw new Error('The selected photograph is empty. Choose another result.');

    storagePath = `catalog/${productId}/${randomUUID()}.webp`;
    const upload = await database.storage.from('product-images').upload(storagePath, bytes, {
      contentType,
    });
    if (upload.error) throw new Error(`Could not save the photograph to local storage: ${upload.error.message}. Check that the uploads directory is writable.`);
    storagePath = upload.data.path; // storage normalizes source images to .webp

    const image = database.storage.from('product-images').getPublicUrl(upload.data.path).data.publicUrl;
    const creator = String(detail.creator || 'Unknown creator').slice(0, 120);
    const licenseLabel = `${license.toUpperCase()}${detail.license_version ? ` ${detail.license_version}` : ''}`;
    const { error: updateError } = await database.from('products').update({
      image,
      image_source: 'licensed_upload',
      image_attribution: creator,
      image_source_url: sourceUrl,
      image_license: licenseLabel,
      image_license_url: licenseUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', productId);

    if (updateError) {
      await database.storage.from('product-images').remove([storagePath]);
      storagePath = '';
      throw new Error(`The image was uploaded, but the product record could not be updated: ${updateError.message}`);
    }

    return NextResponse.json({
      productId,
      productName: product.name,
      image,
      attribution: creator,
      license: licenseLabel,
      sourceUrl,
      message: `A licensed photo was stored in ShopSphere and assigned to ${product.name}.`,
    });
  } catch (error) {
    if (storagePath) await database.storage.from('product-images').remove([storagePath]);
    const message = error instanceof Error ? error.message : 'Could not assign the selected photograph.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
