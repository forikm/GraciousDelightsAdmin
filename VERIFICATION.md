# Verification

The shared HTTP integration test uses two isolated server origins connected to one PostgreSQL engine. It verifies customer ordering, admin review, ingredient deductions, stale revisions, ownership, copied-cookie isolation, CSRF rejection, image serving and rate limits. Customer login returns 404; admin state requires sign-in; authenticated admin cannot submit customer checkout.

32 tests pass in the customer checkout. Production verification is recorded after release.
