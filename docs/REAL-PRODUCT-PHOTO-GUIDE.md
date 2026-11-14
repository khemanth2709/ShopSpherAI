# Product photo management

Product photos can be uploaded from the administrator product-photo workflow. The local edition accepts JPG, PNG, and WebP images up to 5 MB and checks that the selected product ID exists before associating the image.

Images are saved below `public/uploads/product-images/`. The SQLite product row stores the corresponding `/uploads/product-images/...` path, source, attribution, and licence metadata when supplied. Only an authenticated administrator can upload or remove product images.

Keep the upload directory backed up together with `data/shopsphere.sqlite`. The bundled local SVG artwork remains available for products without an uploaded photograph.


## Verify local product-photo assignments

Run `npm run photos:status` from the project folder. It reports placeholder rows, local photo assignments, and uploaded files missing from `public/uploads`. After bulk imports, return to the storefront or refresh the browser; the product catalogue query refreshes on focus and uses unique immutable image filenames.
