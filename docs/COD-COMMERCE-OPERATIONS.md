# Cash-on-delivery commerce operations

ShopSphere's current checkout flow supports Cash on Delivery. Order creation validates the customer session, product availability, server-side prices, address details, and shipping method. The order header, item snapshots, order event, stock decrement, and initial notification are committed together.

Administrators can confirm COD collection after an order is delivered, update the order status, save courier/tracking information, and add shipment events. Those actions are validated in server-side business functions and persisted in SQLite.

Customers can view shipment events, request returns for delivered orders during the return window, and see return/refund status. Paid/refunded states are administrative records; this edition does not collect online payments or issue automatic bank refunds.

The SQLite schema and indexes are created automatically at application startup. Back up both `data/shopsphere.sqlite` and `public/uploads/product-images/` after stopping the server.
