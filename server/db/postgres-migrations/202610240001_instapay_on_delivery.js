exports.up = async function (knex) {
  await knex.raw("ALTER TABLE orders DROP CONSTRAINT orders_payment_check");
  await knex.raw("ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment_method IN ('CASH_ON_DELIVERY', 'INSTAPAY_ON_DELIVERY'))");
};
exports.down = async function (knex) {
  // Preserve recorded payment choices: rollback is blocked while InstaPay orders exist.
  await knex.raw("ALTER TABLE orders DROP CONSTRAINT orders_payment_check");
  await knex.raw("ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment_method IN ('CASH_ON_DELIVERY'))");
};
