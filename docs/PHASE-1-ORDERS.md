# Orders and checkout

The SQLite edition stores order, order-item, and order-status history records in the local database. Customer order routes are scoped to the signed-in user; administrator routes require the administrator role.

Checkout currently uses Cash on Delivery. The server reloads product prices and stock from SQLite, validates the cart, and creates the order while decrementing stock inside a transaction. Client-submitted prices are never trusted.

Order cancellation restores stock within a transaction. Administrators can update order status, record COD collection, and manage shipment information. Customers can view the order history and submit a return request within the configured return window.

The application does not require a hosted database migration. The schema is initialized automatically by `lib/database/db.ts` when the server first imports the database module.
