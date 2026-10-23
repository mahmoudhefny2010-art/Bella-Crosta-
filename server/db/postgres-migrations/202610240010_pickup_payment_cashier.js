exports.up = async function up(knex) {
  await knex.raw("ALTER TABLE orders DROP CONSTRAINT orders_payment_check");
  await knex.raw("ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment_method IN ('CASH_ON_DELIVERY','INSTAPAY_ON_DELIVERY','PAY_AT_CASHIER'))");
};

exports.down = async function down(knex) {
  await knex.raw("ALTER TABLE orders DROP CONSTRAINT orders_payment_check");
  await knex.raw("ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment_method IN ('CASH_ON_DELIVERY','INSTAPAY_ON_DELIVERY'))");
};
