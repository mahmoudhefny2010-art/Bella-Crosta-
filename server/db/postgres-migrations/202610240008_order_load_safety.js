exports.up = async function(knex) {
  await knex.schema.createTable('order_requests', table => {
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('request_key').notNullable();
    table.string('request_hash',64).notNullable();
    table.uuid('order_id').notNullable().references('id').inTable('orders');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.primary(['user_id','request_key']);
    table.index(['order_id'],'order_requests_order_idx');
  });
  await knex.schema.alterTable('orders', table => {
    table.index(['created_at','id'],'orders_created_id_idx');
    table.index(['assigned_driver_id','created_at','id'],'orders_driver_created_idx');
  });
};
exports.down = async function(knex) {
  await knex.schema.dropTable('order_requests');
  await knex.schema.alterTable('orders',table=>{
    table.dropIndex(['created_at','id'],'orders_created_id_idx');
    table.dropIndex(['assigned_driver_id','created_at','id'],'orders_driver_created_idx');
  });
};
