# Product photos and product navigation

ShopSphere includes 750 product records across 25 categories. Each catalogue entry has a local artwork placeholder. Administrators can upload licensed JPG, PNG, or WebP photos from `/admin/product-photos`; the server validates the product ID, image type, size, and administrator session before saving the file locally.

Uploaded images are stored in `public/uploads/product-images/`, while their local path and attribution fields are stored in SQLite. Keep the image directory and SQLite database together when backing up or moving the application.

Guests can browse the catalogue and product detail pages. Customers can sign in to manage their account, cart, wishlist, checkout, orders, and returns. Administrators can manage products, catalogue photos, inventory, order fulfilment, and return requests.


## Bundled generated photographs

The catalogue currently bundles 550 AI-generated illustrative WebP images mapped to 550 product IDs. These are generic catalogue visuals, not supplier/manufacturer photography; some of the latest contact-sheet crops are category-level thumbnails rather than exact SKU representations. New databases use them automatically. For an existing SQLite database, run `npm run photos:apply-bundled` to assign the files while preserving existing merchant, supplier, or licensed photos. The remaining 200 catalogue entries continue to use their existing SVG artwork.
