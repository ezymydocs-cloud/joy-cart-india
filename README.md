# TrendyToyz

Online toy store for India with a full admin panel.

- Storefront: home banners, categories, product listing with search/filters, product pages, cart, checkout (COD + optional Razorpay), My Orders with tracking.
- Admin (`/admin`): dashboard, orders workflow (Placed → Accepted → Packed → Shipped → Delivered / Cancelled), shipping labels and invoices (PDF), products, categories, banners, customers, couriers, settings.

## Required keys
- `RESEND_API_KEY` (and optional `RESEND_FROM_EMAIL`, e.g. `TrendyToyz <orders@yourdomain.in>`): order emails.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: online payments (turn on in Admin → Settings).
