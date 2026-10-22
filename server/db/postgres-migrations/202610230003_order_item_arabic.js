exports.up = knex => knex.schema.alterTable('order_items', table => table.string('product_name_ar', 160).notNullable().defaultTo(''));
exports.down = knex => knex.schema.alterTable('order_items', table => table.dropColumn('product_name_ar'));
