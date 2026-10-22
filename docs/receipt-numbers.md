# Website receipt numbers

Orders now have a database-generated `receipt_number` using SQL Server IDENTITY with a unique index. The customer and staff interfaces format it as `#1`. Existing order UUIDs and `order_number` references remain intact. Concurrent inserts receive distinct numbers; rollbacks may leave gaps. Numbers assigned to historical orders do not imply their chronological order.

Migration `202610240009_receipt_numbers.js` preserves existing orders and gives them receipt numbers. New numbers appear in customer tracking/history, kitchen, delivery, owner, admin and Excel reports. Owner order search accepts a number or its hash-prefixed form.

These are website receipt references. No POS connection has been configured because the shop's system is not yet identified. Once its product name, version, supported integration method and documentation are available, retain the website receipt reference and map the POS receipt ID separately. No credentials should be pasted into chat.

No additional tests were run for this follow-up.
