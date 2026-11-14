# Implementation overview

1. Local data foundation: SQLite schema, automatic catalogue seed, indexes, WAL mode and foreign-key enforcement.
2. Identity and accounts: salted scrypt password hashes, expiring HTTP-only sessions, customer profiles, saved addresses and account preferences.
3. Storefront: 750 bundled catalogue products, 25 categories, local artwork, search, comparison, wishlist and recommendations.
4. Commerce: transactional Cash on Delivery checkout, stock validation/decrement, idempotency key, order events and notifications.
5. Fulfilment: administrator order transitions, courier tracking, delivery events, COD collection and return workflow.
6. Operations: local admin image uploads, analytics endpoint, database integrity endpoint and release scripts.

The SQLite edition is intended for one persistent Node.js server or a single mounted data volume. It does not rely on a hosted database API or realtime service.
