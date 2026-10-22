# Handling larger order queues

## Changes

- Kitchen returns up to 25 orders per status with independent pagination and full counts, rather than loading every active order into one response. Empty pages are clamped after order transitions.
- Kitchen, delivery and owner queues batch item retrieval. They do not fetch every order's complete event/GPS history. Full details remain available from the order-detail endpoints.
- Checkout batches product and option lookups across cart lines while retaining availability, product ownership and server-side pricing validation.
- Realtime updates are coalesced with a 400 ms interval and a single running refresh. Hidden tabs defer refresh; delivery forms retain payment drafts and are not replaced while the driver is typing or scanning. Version counters reject stale kitchen/delivery responses.
- Checkout includes a retry key retained for an identical payload within the browser tab. A transaction-owned SQL Server application lock serializes matching user/key requests. A committed retry returns the original order instead of creating another order or sending a second new-order notification. Reusing a key with changed details returns 409. Older clients without a key retain their existing behavior.
- Existing transactions and SQL update locks continue to protect status, assignment and delivery/payment transitions. No workflow stage is skipped.
- Date filtering compares indexed UTC timestamps against Cairo midnight boundaries, preserving local-day behavior without applying date conversion to every order row.
- Migration `202610240008_order_load_safety.js` adds the retry mapping table and indexes for order date and driver/date sorting. It preserves existing orders. Connection acquisition waits are bounded to 15 seconds; driver query timeout remains unchanged.

## Capacity limits

These changes reduce repeated database work and bound queue response sizes. They do not establish a tested maximum number of concurrent users or orders. No load or regression tests were run for this follow-up. A capacity claim requires an isolated load run against a production-sized SQL database and the actual hosting resources, including checkout retries, competing driver actions and realtime clients.

Owner Excel exports retain their existing 10,000-order limit; use a date range for larger histories. The owner kitchen preview remains bounded to 100 records, with the full history in Orders.
