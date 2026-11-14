'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, isDatabaseReady } from '@/lib/database/client';
import { useShopStore } from '@/store/shopStore';
import type { ShopUser } from '@/types/domain';

type ShoppingPreferences = {
  cart: Record<string, number>;
  wishlist: string[];
  savedForLater: string[];
  recentlyViewed: string[];
  searchHistory: string[];
};

const emptyPreferences: ShoppingPreferences = {
  cart: {},
  wishlist: [],
  savedForLater: [],
  recentlyViewed: [],
  searchHistory: [],
};

function normalizePreferences(value: unknown): ShoppingPreferences {
  if (!value || typeof value !== 'object') return emptyPreferences;
  const data = value as Partial<ShoppingPreferences>;
  const validCart = data.cart && typeof data.cart === 'object' && !Array.isArray(data.cart)
    ? Object.fromEntries(Object.entries(data.cart).filter(([id, qty]) => typeof id === 'string' && Number.isInteger(qty) && Number(qty) > 0)) as Record<string, number>
    : {};

  return {
    cart: validCart,
    wishlist: Array.isArray(data.wishlist) ? data.wishlist.filter((id): id is string => typeof id === 'string') : [],
    savedForLater: Array.isArray(data.savedForLater) ? data.savedForLater.filter((id): id is string => typeof id === 'string') : [],
    recentlyViewed: Array.isArray(data.recentlyViewed) ? data.recentlyViewed.filter((id): id is string => typeof id === 'string') : [],
    searchHistory: Array.isArray(data.searchHistory) ? data.searchHistory.filter((item): item is string => typeof item === 'string') : [],
  };
}

type LocalAuthUser = { id: string; email?: string; user_metadata?: { full_name?: string } };

async function mapAuthUser(authUser: LocalAuthUser): Promise<ShopUser> {
  const database = createClient();
  const { data: profile, error } = await database
    .from('profiles')
    .select('full_name, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;

  const metadataName = typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : '';
  return {
    id: authUser.id,
    name: profile?.full_name || metadataName || authUser.email?.split('@')[0] || 'ShopSphere customer',
    email: authUser.email || '',
    role: profile?.role === 'admin' ? 'admin' : 'customer',
  };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useShopStore((state) => state.user);
  const userId = user?.id;
  const setUser = useShopStore((state) => state.setUser);
  const logout = useShopStore((state) => state.logout);
  const setAuthReady = useShopStore((state) => state.setAuthReady);
  const setDatabasePreferences = useShopStore((state) => state.setDatabasePreferences);
  const cart = useShopStore((state) => state.cart);
  const wishlist = useShopStore((state) => state.wishlist);
  const savedForLater = useShopStore((state) => state.savedForLater);
  const recentlyViewed = useShopStore((state) => state.recentlyViewed);
  const searchHistory = useShopStore((state) => state.searchHistory);
  const [databaseReadyUser, setDatabaseReadyUser] = useState<string | null>(null);
  const lastDatabaseSnapshot = useRef('');
  const preferences = useMemo<ShoppingPreferences>(() => ({
    cart, wishlist, savedForLater, recentlyViewed, searchHistory,
  }), [cart, wishlist, savedForLater, recentlyViewed, searchHistory]);

  useEffect(() => {
    if (!isDatabaseReady()) {
      // This edition does not retain an unscoped guest identity or shopping profile.
      logout();
      setDatabaseReadyUser(null);
      setAuthReady(true);
      return;
    }

    const database = createClient();
    let active = true;

    async function applyAuthUser(authUser: LocalAuthUser | null) {
      if (!authUser) {
        if (active) {
          // Never leave a previous account's persisted preferences visible while signed out.
          logout();
          setDatabaseReadyUser(null);
          setAuthReady(true);
        }
        return;
      }

      try {
        const shopUser = await mapAuthUser(authUser);
        if (active) setUser(shopUser);
      } catch (error) {
        console.error('Could not initialize the ShopSphere user profile.', error);
        if (active) logout();
      } finally {
        if (active) setAuthReady(true);
      }
    }

    void database.auth.getUser().then(({ data, error }) => {
      if (error) console.warn('Could not restore local session:', error.message);
      return applyAuthUser(data.user);
    });

    const { data: { subscription } } = database.auth.onAuthStateChange((_event, session) => {
      // Defer profile loading out of the auth event callback to avoid nested state updates.
      window.setTimeout(() => { void applyAuthUser(session?.user ?? null); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [logout, setAuthReady, setUser]);


  useEffect(() => {
    if (!isDatabaseReady() || !userId) return;
    const database = createClient();
    const channel = database
      .channel(`shop-profile-${userId}`)
      .on('sqlite_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`, 
      }, (payload) => {
        const profile = payload.new as { id?: string; full_name?: string; role?: string };
        const current = useShopStore.getState().user;
        if (!current || current.id !== userId) return;
        setUser({
          ...current,
          name: profile.full_name || current.name,
          role: profile.role === 'admin' ? 'admin' : 'customer',
        });
      })
      .subscribe();

    return () => { void database.removeChannel(channel); };
  }, [userId, setUser]);

  useEffect(() => {
    if (!isDatabaseReady() || !userId) {
      setDatabaseReadyUser(null);
      lastDatabaseSnapshot.current = '';
      setDatabasePreferences(emptyPreferences);
      return;
    }

    const activeUserId = userId;
    const database = createClient();
    let active = true;
    setDatabaseReadyUser(null);
    // Clear persisted values before fetching this user's row; never flash another account's data.
    setDatabasePreferences(emptyPreferences);

    async function loadPreferences() {
      const { data, error } = await database
        .from('user_preferences')
        .select('data')
        .eq('user_id', activeUserId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error('Could not load saved shopping preferences. Check the local SQLite database.', error.message);
        return;
      }

      if (data?.data) {
        const normalized = normalizePreferences(data.data);
        lastDatabaseSnapshot.current = JSON.stringify(normalized);
        setDatabasePreferences(normalized);
      } else {
        // Never carry another account's or a legacy demo cart into a new real account.
        lastDatabaseSnapshot.current = JSON.stringify(emptyPreferences);
        setDatabasePreferences(emptyPreferences);
      }
      setDatabaseReadyUser(activeUserId);
    }

    void loadPreferences();

    const channel = database
      .channel(`shop-preferences-${activeUserId}`)
      .on('sqlite_changes', {
        event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${activeUserId}`,  
      }, (payload) => {
        if (!active || !payload.new || !('data' in payload.new)) return;
        const normalized = normalizePreferences(payload.new.data);
        lastDatabaseSnapshot.current = JSON.stringify(normalized);
        setDatabasePreferences(normalized);
      })
      .subscribe();

    return () => {
      active = false;
      void database.removeChannel(channel);
    };
  }, [userId, setDatabasePreferences]);

  useEffect(() => {
    if (!userId || databaseReadyUser !== userId || !isDatabaseReady()) return;
    const snapshot = JSON.stringify(preferences);
    if (snapshot === lastDatabaseSnapshot.current) return;

    const timeout = window.setTimeout(async () => {
      const database = createClient();
      const { error } = await database.from('user_preferences').upsert({
        user_id: userId,
        data: preferences,
      }, { onConflict: 'user_id' });

      if (error) {
        console.error('Could not sync shopping preferences:', error.message);
        return;
      }
      lastDatabaseSnapshot.current = snapshot;
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [userId, databaseReadyUser, preferences]);

  return <>{children}</>;
}
