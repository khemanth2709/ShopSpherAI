/** Safely converts a Next.js dynamic route parameter into a catalogue ID. */
export function decodeProductRouteId(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return '';

  try {
    return decodeURIComponent(rawValue);
  } catch {
    // Malformed URL encoding should resolve to a normal not-found state.
    return rawValue;
  }
}

/** Resolves products from the same combined catalogue used by the storefront. */
export function findProductByRouteId<T extends { id: string }>(
  catalogue: T[],
  routeId: string,
): T | undefined {
  if (!routeId) return undefined;
  return catalogue.find((product) => product.id === routeId);
}
