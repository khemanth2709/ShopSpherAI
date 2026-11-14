# ShopSphere AI – 158-photo catalogue update

## Bundled image coverage

- Existing photo assignments retained: 192.
- New local WebP images added in this update: 158.
- Total bundled AI-generated product-photo assignments: 350 of 750 products.
- Products that still use the original product-matched SVG artwork: 400.
- Every new image is a separate file under `public/product-photos/generated/` and is mapped by product ID in `public/products/manifest.json`, `public/product-photos/generated/photo-manifest.json`, and `lib/products.ts`.

**Image disclosure:** these are AI-generated illustrative product images, not manufacturer-verified photographs or supplier assets. Use licensed supplier imagery for exact SKU representation where required.

## Applying the bundle to an existing SQLite database

```powershell
npm install
npm run photos:apply-bundled
npm run photos:status
npm run dev
```

`photos:apply-bundled` updates only placeholder/SVG product-image records and preserves existing merchant, supplier, or licensed photos. Keep your existing `.env.local`, `data/shopsphere.sqlite`, and `public/uploads` when replacing an older project folder.

## New product-ID assignments

| Product ID | Image file |
|---|---|
| `p-082` | `catalog-193.webp` |
| `p-083` | `catalog-194.webp` |
| `p-084` | `catalog-195.webp` |
| `p-085` | `catalog-196.webp` |
| `p-086` | `catalog-197.webp` |
| `p-087` | `catalog-198.webp` |
| `p-088` | `catalog-199.webp` |
| `p-092` | `catalog-200.webp` |
| `p-094` | `catalog-201.webp` |
| `p-095` | `catalog-202.webp` |
| `p-096` | `catalog-203.webp` |
| `p-097` | `catalog-204.webp` |
| `p-098` | `catalog-205.webp` |
| `p-099` | `catalog-206.webp` |
| `p-100` | `catalog-207.webp` |
| `p-103` | `catalog-208.webp` |
| `p-104` | `catalog-209.webp` |
| `p-105` | `catalog-210.webp` |
| `p-106` | `catalog-211.webp` |
| `p-108` | `catalog-212.webp` |
| `p-110` | `catalog-213.webp` |
| `p-111` | `catalog-214.webp` |
| `p-112` | `catalog-215.webp` |
| `p-114` | `catalog-216.webp` |
| `p-115` | `catalog-217.webp` |
| `p-116` | `catalog-218.webp` |
| `p-117` | `catalog-219.webp` |
| `p-118` | `catalog-220.webp` |
| `p-119` | `catalog-221.webp` |
| `p-120` | `catalog-222.webp` |
| `p-121` | `catalog-223.webp` |
| `p-122` | `catalog-224.webp` |
| `p-123` | `catalog-225.webp` |
| `p-124` | `catalog-226.webp` |
| `p-125` | `catalog-227.webp` |
| `p-126` | `catalog-228.webp` |
| `p-127` | `catalog-229.webp` |
| `p-128` | `catalog-230.webp` |
| `p-129` | `catalog-231.webp` |
| `p-130` | `catalog-232.webp` |
| `p-131` | `catalog-233.webp` |
| `p-132` | `catalog-234.webp` |
| `p-133` | `catalog-235.webp` |
| `p-134` | `catalog-236.webp` |
| `p-135` | `catalog-237.webp` |
| `p-136` | `catalog-238.webp` |
| `p-137` | `catalog-239.webp` |
| `p-138` | `catalog-240.webp` |
| `p-140` | `catalog-241.webp` |
| `p-391` | `catalog-242.webp` |
| `p-392` | `catalog-243.webp` |
| `p-393` | `catalog-244.webp` |
| `p-394` | `catalog-245.webp` |
| `p-400` | `catalog-246.webp` |
| `p-407` | `catalog-247.webp` |
| `p-408` | `catalog-248.webp` |
| `p-414` | `catalog-249.webp` |
| `p-415` | `catalog-250.webp` |
| `p-416` | `catalog-251.webp` |
| `p-726` | `catalog-252.webp` |
| `p-728` | `catalog-253.webp` |
| `p-732` | `catalog-254.webp` |
| `p-733` | `catalog-255.webp` |
| `p-734` | `catalog-256.webp` |
| `p-736` | `catalog-257.webp` |
| `p-737` | `catalog-258.webp` |
| `p-738` | `catalog-259.webp` |
| `p-739` | `catalog-260.webp` |
| `p-740` | `catalog-261.webp` |
| `p-451` | `catalog-262.webp` |
| `p-453` | `catalog-263.webp` |
| `p-455` | `catalog-264.webp` |
| `p-457` | `catalog-265.webp` |
| `p-459` | `catalog-266.webp` |
| `p-461` | `catalog-267.webp` |
| `p-463` | `catalog-268.webp` |
| `p-465` | `catalog-269.webp` |
| `p-467` | `catalog-270.webp` |
| `p-469` | `catalog-271.webp` |
| `p-156` | `catalog-272.webp` |
| `p-160` | `catalog-273.webp` |
| `p-164` | `catalog-274.webp` |
| `p-168` | `catalog-275.webp` |
| `p-170` | `catalog-276.webp` |
| `p-172` | `catalog-277.webp` |
| `p-174` | `catalog-278.webp` |
| `p-512` | `catalog-279.webp` |
| `p-514` | `catalog-280.webp` |
| `p-515` | `catalog-281.webp` |
| `p-516` | `catalog-282.webp` |
| `p-518` | `catalog-283.webp` |
| `p-520` | `catalog-284.webp` |
| `p-524` | `catalog-285.webp` |
| `p-482` | `catalog-286.webp` |
| `p-484` | `catalog-287.webp` |
| `p-486` | `catalog-288.webp` |
| `p-487` | `catalog-289.webp` |
| `p-489` | `catalog-290.webp` |
| `p-491` | `catalog-291.webp` |
| `p-541` | `catalog-292.webp` |
| `p-543` | `catalog-293.webp` |
| `p-546` | `catalog-294.webp` |
| `p-559` | `catalog-295.webp` |
| `p-505` | `catalog-296.webp` |
| `p-502` | `catalog-297.webp` |
| `p-679` | `catalog-298.webp` |
| `p-503` | `catalog-299.webp` |
| `p-507` | `catalog-300.webp` |
| `p-509` | `catalog-301.webp` |
| `p-695` | `catalog-302.webp` |
| `p-698` | `catalog-303.webp` |
| `p-699` | `catalog-304.webp` |
| `p-701` | `catalog-305.webp` |
| `p-703` | `catalog-306.webp` |
| `p-705` | `catalog-307.webp` |
| `p-707` | `catalog-308.webp` |
| `p-709` | `catalog-309.webp` |
| `p-711` | `catalog-310.webp` |
| `p-717` | `catalog-311.webp` |
| `p-155` | `catalog-312.webp` |
| `p-159` | `catalog-313.webp` |
| `p-161` | `catalog-314.webp` |
| `p-163` | `catalog-315.webp` |
| `p-167` | `catalog-316.webp` |
| `p-169` | `catalog-317.webp` |
| `p-171` | `catalog-318.webp` |
| `p-173` | `catalog-319.webp` |
| `p-175` | `catalog-320.webp` |
| `p-177` | `catalog-321.webp` |
| `p-242` | `catalog-322.webp` |
| `p-243` | `catalog-323.webp` |
| `p-246` | `catalog-324.webp` |
| `p-247` | `catalog-325.webp` |
| `p-250` | `catalog-326.webp` |
| `p-252` | `catalog-327.webp` |
| `p-253` | `catalog-328.webp` |
| `p-256` | `catalog-329.webp` |
| `p-263` | `catalog-330.webp` |
| `p-294` | `catalog-331.webp` |
| `p-332` | `catalog-332.webp` |
| `p-334` | `catalog-333.webp` |
| `p-344` | `catalog-334.webp` |
| `p-301` | `catalog-335.webp` |
| `p-303` | `catalog-336.webp` |
| `p-315` | `catalog-337.webp` |
| `p-379` | `catalog-338.webp` |
| `p-370` | `catalog-339.webp` |
| `p-389` | `catalog-340.webp` |
| `p-478` | `catalog-341.webp` |
| `p-529` | `catalog-342.webp` |
| `p-530` | `catalog-343.webp` |
| `p-532` | `catalog-344.webp` |
| `p-534` | `catalog-345.webp` |
| `p-535` | `catalog-346.webp` |
| `p-231` | `catalog-347.webp` |
| `p-289` | `catalog-348.webp` |
| `p-405` | `catalog-349.webp` |
| `p-406` | `catalog-350.webp` |
