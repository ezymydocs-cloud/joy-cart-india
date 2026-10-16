<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Order placement, status transitions, cancellation and stock changes happen only in SQL security-definer functions (place_order, admin_update_order_status, cancel_my_order); clients have SELECT-only on orders so the backend enforces pricing and the status flow.
- Storage buckets are private (workspace blocks public buckets); images are served through /api/public/img/$bucket/$ and stored in tables as those app URLs.
- Order emails go through src/lib/email.server.ts (Resend), are logged in email_logs, and never throw into order flows.
- PDFs (invoice, 4x6 label) are generated client-side with jspdf in src/lib/pdf.ts.
- tsconfig strict extras (exactOptionalPropertyTypes etc.) are disabled to work with generated DB types.
