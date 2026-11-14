# Bundled product photographs

This release bundles **550 AI-generated illustrative WebP catalogue images** under `public/product-photos/generated/`, mapped to 550 of the 750 products. The images are for generic, fictional/unbranded catalogue entries; they are not manufacturer-provided photographs, supplier-verified SKU images, or downloads from Amazon/Flipkart. The 150 newest contact-sheet crops are category-level thumbnails in some cases and should be replaced with supplier-authorized assets when exact SKU accuracy is required.

The remaining **200** catalogue entries continue to use their original unique product-matched SVG artwork.

New SQLite databases seed the photo mappings automatically through `lib/products.ts`. To update an existing SQLite database without overwriting merchant, supplier, or licensed photos, run `npm run photos:apply-bundled`, then `npm run photos:status`.

See [the latest 200-photo update report](./PHOTO-ADDITIONS-NEXT-200.md) for the new mappings and image provenance.
