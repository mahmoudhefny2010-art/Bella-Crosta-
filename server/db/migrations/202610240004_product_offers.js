exports.up = async function up(knex) {
  await knex.schema.alterTable('products', table => {
    table.integer('sale_price_egp').nullable();
  });
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_sale_price_check CHECK (sale_price_egp IS NULL OR (sale_price_egp > 0 AND sale_price_egp < price_egp))');
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE products DROP CONSTRAINT products_sale_price_check');
  await knex.schema.alterTable('products', table => {
    table.dropColumn('sale_price_egp');
  });
};
