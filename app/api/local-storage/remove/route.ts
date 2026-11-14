import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { getUserFromSession, SESSION_COOKIE } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const store=await cookies(); const user=getUserFromSession(store.get(SESSION_COOKIE)?.value);
  if(user?.profile?.role!=='admin') return NextResponse.json({error:{message:'Administrator access is required.'}},{status:403});
  try {
    const body=await request.json() as {bucket?:unknown;paths?:unknown};
    if(body.bucket!=='product-images'||!Array.isArray(body.paths)) return NextResponse.json({error:{message:'Invalid storage request.'}},{status:400});
    const base=path.join(process.cwd(),'public','uploads','product-images');
    for(const item of body.paths){
      if(typeof item!=='string') continue;
      const parts=item.replaceAll('\\','/').split('/').filter(Boolean);
      if(parts.some(part=>part==='.'||part==='..')) continue;
      const absolute=path.join(base,...parts);
      if(absolute.startsWith(`${base}${path.sep}`)) await unlink(absolute).catch(()=>undefined);
    }
    return NextResponse.json({data:[],error:null});
  } catch(error){return NextResponse.json({error:{message:error instanceof Error?error.message:'Could not remove file.'}},{status:400});}
}
