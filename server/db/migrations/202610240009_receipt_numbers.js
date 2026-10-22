exports.up = async function(knex) {
  await knex.raw('ALTER TABLE orders ADD receipt_number bigint IDENTITY(1,1) NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX orders_receipt_number_unique ON orders(receipt_number)');
};
exports.down = async function(knex) {
  if (await knex('orders').first()) throw Error('Preserve issued receipt numbers before rolling back.');
  await knex.raw('DROP INDEX orders_receipt_number_unique ON orders');
  await knex.raw('ALTER TABLE orders DROP COLUMN receipt_number');
};
