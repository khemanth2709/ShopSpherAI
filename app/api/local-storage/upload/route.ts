import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getUserFromSession, SESSION_COOKIE } from '@/lib/database/auth';
import sharp from 'sharp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string,string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
export async function POST(request: Request) {
  try {
    const store = await cookies();
    const user = getUserFromSession(store.get(SESSION_COOKIE)?.value);
    if (user?.profile?.role !== 'admin') return NextResponse.json({ data:null,error:{message:'Administrator access is required.'} }, { status:403 });
    const form = await request.formData();
    const file = form.get('file');
    const rawPath = String(form.get('path') || '');
    if (form.get('bucket') !== 'product-images') return NextResponse.json({ data: null, error: { message: 'Unknown upload bucket.' } }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({data:null,error:{message:'Choose an image file.'}},{status:400});
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({data:null,error:{message:'Images must be smaller than 5 MB.'}},{status:400});
    const ext = TYPES[file.type];
    if (!ext) return NextResponse.json({data:null,error:{message:'Only JPG, PNG and WebP images are supported.'}},{status:400});
    const parts = rawPath.replaceAll('\\','/').split('/').filter(Boolean);
    if (!parts.length || parts.length > 5 || parts.some((part)=>! /^[A-Za-z0-9._-]{1,100}$/.test(part) || part==='.' || part==='..')) return NextResponse.json({data:null,error:{message:'Invalid upload path.'}},{status:400});
    const sourcePath = parts.join('/');
    if (!sourcePath.toLowerCase().endsWith(`.${ext}`)) return NextResponse.json({data:null,error:{message:'File extension does not match its image type.'}},{status:400});
    // Normalize every supplier upload to a cache-friendly WebP image before it
    // reaches the public directory. The DB stores the final .webp path.
    const filePath = sourcePath.replace(/\.(?:jpe?g|png|webp)$/i, '.webp');
    const base = path.join(process.cwd(),'public','uploads','product-images');
    const destination = path.join(base,filePath);
    if (!destination.startsWith(`${base}${path.sep}`)) return NextResponse.json({data:null,error:{message:'Invalid upload path.'}},{status:400});
    const input = Buffer.from(await file.arrayBuffer());
    const optimized = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,optimized,{flag:'wx'});
    return NextResponse.json({data:{path:filePath},error:null});
  } catch (error) { return NextResponse.json({data:null,error:{message:error instanceof Error?error.message:'Upload failed.'}},{status:400}); }
}
