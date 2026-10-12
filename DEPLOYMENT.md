# Admin deployment

Repository: https://github.com/40kilometer/GraciousDelightsAdmin

Vercel workspace fita4; project gracious-delights-admin, distinct from the customer project gracious-delights and Fetch-it Admin.

Use Other framework, Node 22.x, npm run build, output dist. Configure production DATABASE_URL (existing Neon pooled URL with sslmode=verify-full), ADMIN_EMAIL, and the existing ADMIN_PASSWORD_HASH. APP_ORIGIN, if set, must be the admin origin rather than the customer origin.

No migration or seed is needed for the existing database. Both sites use shop_state, product_images, admin_sessions and request_limits. Customer requests appear in the admin inbox on its 15-second refresh.

The admin PWA installs independently of the customer PWA. Sign in with the existing email and password. Customer-site sessions are never authorized as admin.

Verify the target project before every deployment. Preview deployments must have separate database and credentials before they can process real changes.
