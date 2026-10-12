# Gracious Delights Admin

Separate kitchen workspace for orders, products, recipes, ingredient inventory and activity history. Customer ordering lives at https://gracious-delights-chi.vercel.app/. Both deployments use the same Neon database.

This repository serves admin pages only. The API requires an authenticated admin session before returning shop state or accepting mutations. Customer ordering is rejected here. Sessions use host-only HttpOnly cookies and same-origin JSON requests.

Set production DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD_HASH in the separate Vercel project gracious-delights-admin. Reuse the existing Gracious Delights database and credentials; do not reset or seed it. APP_ORIGIN may be set to the exact admin HTTPS origin; when omitted, the API validates against the deployment request host. Keep production secrets out of source files.

Install: npm ci. Test: npm test. Build: npm run build. Run locally with server.mjs and a local .env.local.

Changes to shared API/domain files should be coordinated with the customer repository https://github.com/forikm/Gracious-Delights.
