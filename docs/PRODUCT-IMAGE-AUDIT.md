# Product Image Audit — v10

## Result

- Products: 750
- Categories: 25
- Products per category: 30
- Distinct local SVG files: 750
- External image URLs in the starter catalogue manifest: 0
- Duplicate SVG file hashes: 0
- Missing starter image files: 0
- Image metadata (product ID, full name, category): matched for every manifest entry

## Approach

The previous starter catalogue reused a small image pool across many unrelated SKUs. v10 replaces each starter image with a separate local SVG illustration. The illustration type is selected using the product category and product name (for example: headphones, shoe, camera, bag, lamp, furniture, book, grocery, pet supplies, garden, kitchen, stationery and smart-home device).

The assets are original illustrations, not photographs and not a claim that the image depicts the exact product sold by a manufacturer. Before a commercial launch, replace each illustration with a licensed, exact-SKU photograph supplied by the vendor/manufacturer.

## Audit command

Run `npm run audit:images` from `shopsphere-prd`. It checks product count, category count, unique file hashes, file presence, product metadata and SKU-specific image paths.

See `product-artwork-preview.png` for one representative visual from each of the 25 categories.
