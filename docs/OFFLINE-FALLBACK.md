# Local catalogue and offline behavior

ShopSphere initializes the 750-product catalogue in the local SQLite database on first server start. The browser keeps a read cache for the product catalogue and can fall back to the bundled catalogue when the API is unavailable.

This fallback is read-only. Cart, wishlist, account, checkout, orders, and administration changes require the local Next.js server and SQLite database to be reachable. A local SQLite database is not automatically synchronized between different computers or hosting instances.

When a request fails, refresh after the server/database is available again. Do not manually delete `data/shopsphere.sqlite` while the application is running.
