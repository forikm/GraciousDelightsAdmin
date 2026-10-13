# Verification

The shared HTTP integration test uses two isolated server origins connected to one PostgreSQL engine. It verifies customer ordering, admin review, ingredient deductions, stale revisions, ownership, copied-cookie isolation, CSRF rejection, image serving and rate limits. Customer login returns 404; admin state requires sign-in; authenticated admin cannot submit customer checkout.

32 tests pass in the customer checkout. Production verification is recorded after release.

Production on October 13, 2026: deployment 4fQXZ3DEX6uqaaDuQ99AcXNL6XyA reached READY. The browser rendered the admin sign-in page. Public state returned 401; incorrect password returned 401, confirming the database and login configuration. Both repository test suites passed all 32 tests and builds independently.

The owner successfully signed in with the existing email and password. Orders displayed the existing customer request, and Products displayed six products, 30 physical units and one reserved unit. The product editor opened with the existing photo and recipe. No production records were changed during verification.

The separate customer deployment 9M77r6zzRy6yk7gRwWvUCafp5Tsd preserves the catalog and reservation, returns public state as customer only, and rejects admin login (404) and admin mutation (403). Credentials remain only in the admin project. Both installed PWAs have distinct names and start routes.
