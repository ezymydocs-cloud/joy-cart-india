# TrendyToyz

Online toy store for India with a modern responsive storefront and full admin panel.

- Storefront: modern hero banners, trust badges, category showcase, product listing with search/filters, product pages, mini-cart drawer, checkout (COD + optional Razorpay), My Orders with tracking.
- Admin (`/admin`): dashboard, orders workflow (Placed → Accepted → Packed → Shipped → Delivered / Cancelled), shipping labels and invoices (PDF), products, categories, banners, customers, couriers, settings.

## Required keys
- `RESEND_API_KEY` (and optional `RESEND_FROM_EMAIL`, e.g. `TrendyToyz <orders@TrendyToyz.com>`): order emails.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: online payments (turn on in Admin → Settings).
