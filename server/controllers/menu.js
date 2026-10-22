const db = require('../db');
exports.list = async (req, res) => {
  const products = await db('products as p').join('categories as c', 'p.category_id', 'c.id')
    .where({ 'p.is_available': true, 'c.is_active': true })
    .select('p.*', 'c.slug as category', 'c.name as category_name', 'c.name_ar as category_name_ar')
    .orderBy('p.is_featured', 'desc').orderBy('p.name');
  const options = await db('product_options').where({ is_available: true }).orderBy('sort_order');
  res.json({ products: products.map(p => ({ ...p, options: options.filter(o => o.product_id === p.id) })) });
};
