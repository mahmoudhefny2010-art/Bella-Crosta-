const upsert = require('../upsert');
exports.up = async knex => {
  const product = await knex('products').where({ slug: 'margherita' }).first();
  if (!product) return;
  const options = [
    { product_id: product.id, option_group: 'sauce', name: 'Tomato sauce', name_ar: 'صلصة الطماطم', price_delta_egp: 0, sort_order: 0 },
    { product_id: product.id, option_group: 'sauce', name: 'Cream sauce', name_ar: 'صلصة الكريمة', price_delta_egp: 0, sort_order: 1 }
  ];
  for (const option of options) await upsert(knex, 'product_options', { product_id: option.product_id, option_group: option.option_group, name: option.name }, option);
};
exports.down = async knex => { await knex('product_options').where({ option_group: 'sauce' }).whereIn('name', ['Tomato sauce', 'Cream sauce']).del(); };
