import { createClient } from '@/lib/database/client';
import type { ShopUser } from '@/types/domain';

type LocalAuthUser = { id: string; email?: string; user_metadata?: { full_name?: string } };

export async function toShopUser(authUser: LocalAuthUser): Promise<ShopUser> {
  const client = createClient();
  const { data: profile, error } = await client.from('profiles').select('full_name,role').eq('id', authUser.id).maybeSingle();
  if (error) throw new Error(`Could not load your account profile: ${error.message}`);
  return {
    id: authUser.id,
    name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'ShopSphere customer',
    email: authUser.email || '',
    role: profile?.role === 'admin' ? 'admin' : 'customer',
  };
}

export async function signInWithEmail(email: string, password: string): Promise<ShopUser> {
  const client = createClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Authentication did not return a user. Please try again.');
  return toShopUser(data.user);
}

export async function registerWithEmail(input: { name: string; email: string; password: string }) {
  const fullName = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2) throw new Error('Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const client = createClient();
  const { data, error } = await client.auth.signUp({ email, password: input.password, options: { data: { full_name: fullName } } });
  if (error) throw new Error(error.message);
  const shopUser = data.session && data.user ? await toShopUser(data.user) : null;
  return { shopUser, needsEmailConfirmation: !data.session };
}

export async function signOutFromLocal(): Promise<void> {
  const { error } = await createClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const normalizedEmail=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
  const response=await fetch('/api/auth/password-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:normalizedEmail}),cache:'no-store'});
  const body=await response.json() as {error?:string;resetUrl?:string};
  if(!response.ok) throw new Error(body.error || 'Could not start password recovery.');
  return body.resetUrl ?? null;
}

export async function updateAccountPassword(password: string, token: string): Promise<void> {
  const validation=(await import('@/lib/authValidation')).validateNewPassword(password);
  if(validation) throw new Error(validation);
  const response=await fetch('/api/auth/password-reset/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,token}),cache:'no-store'});
  const body=await response.json() as {error?:string};
  if(!response.ok) throw new Error(body.error || 'Could not update your password.');
}
