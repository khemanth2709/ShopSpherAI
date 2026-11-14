# ShopSphere AI architecture — SQLite edition

- **Framework:** Next.js App Router, React, TypeScript, Tailwind CSS.
- **Persistence:** SQLite via `better-sqlite3`; the file is created at `data/shopsphere.sqlite` by default.
- **Product data:** the bundled 750-product catalogue is inserted on first database initialization. Active products are queried from SQLite; the browser also has a read fallback to the bundled catalogue.
- **Authentication:** local customer/admin accounts use scrypt password hashes, random opaque session tokens, SHA-256 token hashes in SQLite, and HTTP-only cookies.
- **Authorization:** server adapters enforce administrator roles and customer ownership. Browser queries expose only a restricted set of account/catalogue tables. Checkout, cancellation, order status, stock, shipment, and return operations use validated server-side functions.
- **Commerce:** checkout currently supports Cash on Delivery. Stock reservation and order creation run in a SQLite transaction; prices and product availability are recalculated on the server.
- **Product photos:** uploaded images are stored beneath `public/uploads/product-images/`; the database stores their local URL and attribution metadata.
- **Notifications:** notification records are stored in SQLite and exposed through authenticated API routes.
- **Local updates:** same-tab mutations dispatch browser events. Cross-device live push is not included in this SQLite deployment; views refresh through normal API requests.
- **Deployment:** SQLite requires persistent disk storage and a single application instance (or carefully coordinated shared storage). Do not place the database on an ephemeral serverless filesystem.
