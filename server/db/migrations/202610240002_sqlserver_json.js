exports.up = async knex => {
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_ingredients_json CHECK (ISJSON(ingredients) = 1)');
  await knex.raw('ALTER TABLE orders ADD CONSTRAINT orders_address_json CHECK (ISJSON(address_snapshot) = 1)');
  await knex.raw('ALTER TABLE order_items ADD CONSTRAINT order_items_options_json CHECK (ISJSON(options) = 1)');
};
exports.down = async knex => {
  await knex.raw('ALTER TABLE order_items DROP CONSTRAINT order_items_options_json');
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT orders_address_json');
  await knex.raw('ALTER TABLE products DROP CONSTRAINT products_ingredients_json');
};
