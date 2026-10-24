# Ordering, pickup, notifications and PWA fixes

- Pickup checkout selects cashier payment, excludes delivery addresses, removes delivery fees and restores delivery validation when switched back.
- Cashier payment is supported by the payment service and migration `202610240010_pickup_cashier.js` (applied to the configured database).
- Kitchen staff can confirm payment and collection of ready pickup orders. This records payment and completion atomically. Pickup orders cannot enter driver queues or be assigned to drivers.
- Pickup tracking skips driver confirmation and maps with missing coordinates.
- Notification preferences support opting out. Initialization failures do not leave a usable-looking SDK reference. SDK download has a timeout.
- Push updates are awaited before the request completes, including on serverless hosts. New orders alert kitchen/admin subscribers; ready delivery orders alert their assigned driver. Customer status updates remain enabled.
- PWA offline support installs even when the push SDK CDN fails. Cache version is bumped. Manifest uses dedicated application icons.
- Checkout layout handles narrow screens, hidden controls and RTL; mobile text fields avoid input zoom.

Verification:

- `npm.cmd test`: 9 tests passed, including offline-worker and notification-routing regressions.
- `npm.cmd run test:pickup-ui`: pickup submission and delivery switching at 320, 390, 768 and 1440 pixels, in LTR and RTL, with unavailable map service.
- `npm.cmd run test:pickup`: configured-database pickup lifecycle, idempotency, driver rejection, payment and collection. Temporary records are cleaned up.

Push provider requests are mocked in regression tests. Actual device delivery and installed-app behavior still need a subscribed browser on the configured HTTPS origin. No deployment was performed.
