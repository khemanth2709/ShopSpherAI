'use client';

import { useEffect } from 'react';
import { useShopStore } from '@/store/shopStore';

function migrateLegacyDemoIdentity() {
  try {
    // This one-time migration removes the browser-local account system from older builds.
    localStorage.removeItem('shopsphere-local-users-v1');
    // Remove the previous DummyJSON cache; the product service now caches only SQLite rows.
    localStorage.removeItem('shopsphere-products-cache');
    localStorage.removeItem('shopsphere-database-products-cache');
    // Old checkout drafts contained contact details and were not scoped to an account.
    localStorage.removeItem('shopsphere-checkout-draft');
    const migrationKey = 'shopsphere-v6-auth-migrated';
    const key = 'shopsphere-prd-state';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
      if (parsed.state) {
        delete parsed.state.user;
        // Product inventory is now authoritative in SQLite, not local Zustand overrides.
        delete parsed.state.productOverrides;
        delete parsed.state.archivedProductIds;
        if (localStorage.getItem(migrationKey) !== 'true') {
          delete parsed.state.cart;
          delete parsed.state.wishlist;
          delete parsed.state.savedForLater;
          delete parsed.state.recentlyViewed;
          delete parsed.state.searchHistory;
          delete parsed.state.orders;
          delete parsed.state.reviews;
          delete parsed.state.addresses;
        }
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }
    localStorage.setItem(migrationKey, 'true');
  } catch (error) {
    console.warn('Could not clean legacy local demo-account data.', error);
  }
}

export default function StoreHydrator() {
  useEffect(() => {
    migrateLegacyDemoIdentity();
    void useShopStore.persist.rehydrate().then(() => useShopStore.getState().setHydrated(true));
  }, []);
  return null;
}
