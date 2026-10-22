exports.up = async function(knex) {
  await knex.schema.alterTable('orders', table => {
    table.string('payment_status', 16).notNullable().defaultTo('UNCONFIRMED');
    table.decimal('amount_received_egp', 12, 2).nullable();
    table.decimal('change_due_egp', 12, 2).nullable();
    table.timestamp('paid_at').nullable();
    table.uuid('paid_by').nullable().references('id').inTable('users');
    table.check("payment_status IN ('UNCONFIRMED','UNPAID','PAID')", [], 'orders_payment_status_check');
    table.check("payment_status <> 'PAID' OR (paid_at IS NOT NULL AND paid_by IS NOT NULL AND amount_received_egp IS NOT NULL AND change_due_egp IS NOT NULL AND amount_received_egp >= total_egp AND change_due_egp = amount_received_egp - total_egp)", [], 'orders_payment_received_check');
  });
};
exports.down = async function(knex) {
  if (await knex('orders').where({payment_status:'PAID'}).first()) throw Error('Payment records exist; preserve them before rolling back.');
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT orders_payment_received_check');
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT orders_payment_status_check');
  await knex.schema.alterTable('orders', table => { table.dropForeign('paid_by'); table.dropColumn('paid_by'); table.dropColumn('paid_at'); table.dropColumn('change_due_egp'); table.dropColumn('amount_received_egp'); table.dropColumn('payment_status'); });
};
