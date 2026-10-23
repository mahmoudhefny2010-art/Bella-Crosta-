const {now:databaseNow}=require('../db/dialect');
const express = require('express');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const db = require('../db');
const upsert = require('../db/upsert');
const orders = require('../services/orders');
const notifications = require('../services/notifications');
const media=require('../services/media');
const siteContent = require('../services/site-content');
const businessReports = require('../services/business-reports');
const inEgypt = require('../services/egypt');
const reverseGeocode = require('../services/geocoding');
const { fail } = require('../services/workflow');
const { requireAuth: auth, requireRoles: roles } = require('../middleware/session');
const { ROLE_VALUES, primaryRole, hasRole, replaceUserRoles } = require('../services/roles');
const {dateRange,isPostgres}=require('../db/dialect');
const router = express.Router();
const uuid = z.string().uuid();
const text = (max = 200) => z.string().trim().min(1).max(max);
const optionalText = (max = 200) => z.string().trim().max(max).default('');
const phone = z.string().regex(/^(?:\+20|0)(?:10|11|12|15)\d{8}$/);
const addressSchema = z.object({ label: text(60).default('Home'), address_line: text(300), landmark: optionalText(), floor: optionalText(20), apartment: optionalText(20), phone, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), is_default: z.boolean().default(false) }).strict().refine(value => inEgypt(value.latitude, value.longitude), { path: ['latitude'], message: 'Please choose a location inside Egypt.' });
const body = schema => (req, res, next) => { req.input = schema.parse(req.body); next(); };
router.param('id', (req, res, next, id) => { uuid.parse(id); next(); });
router.get('/health', async (req, res) => { await db.raw('SELECT 1'); res.json({ ok: true, database: isPostgres(db) ? 'postgres' : 'mssql' }); });
router.get('/config', async (req, res) => res.json({ googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL), googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() || null, googleMapsMapId: process.env.GOOGLE_MAPS_MAP_ID?.trim() || null, oneSignalAppId: process.env.ONESIGNAL_APP_ID || null, oneSignalOrigin:process.env.ONESIGNAL_SITE_URL || null, realtimeMode:process.env.VERCEL?'poll':'socket', ...await siteContent.operational(db) }));
router.get('/content', async (req, res) => res.json(siteContent.publicData(await siteContent.read(db))));
router.use('/live',require('./live'));
router.use('/owner', roles('owner'), require('./owner'));
router.get('/geocode/reverse', rateLimit({ windowMs: 60000, limit: 10 }), async (req, res) => {
  const latitude = Number(req.query.lat), longitude = Number(req.query.lon);
  if (!inEgypt(latitude, longitude)) return res.status(400).json({ message: 'Choose a location inside Egypt.' });
  const language = req.query.language === 'ar' ? 'ar' : 'en';
  const address = await reverseGeocode(latitude, longitude, language);
  res.json({ address });
});
router.get('/menu', require('../controllers/menu').list);
router.get('/addresses', auth, async (req, res) => res.json({ addresses: await db('addresses').where({ user_id: req.currentUser.id }).orderBy('is_default', 'desc') }));
router.post('/addresses', auth, body(addressSchema), async (req, res) => {
  const address = await db.transaction(async trx => {
    if (req.input.is_default) await trx('addresses').where({ user_id: req.currentUser.id }).update({ is_default: false });
    const [address] = await trx('addresses').insert({ ...req.input, user_id: req.currentUser.id }).returning('*');
    return address;
  });
  res.status(201).json({ address });
});
router.put('/addresses/:id', auth, body(addressSchema), async (req, res) => {
  const address = await db.transaction(async trx => {
    if (req.input.is_default) await trx('addresses').where({ user_id: req.currentUser.id }).update({ is_default: false });
    const [address] = await trx('addresses').where({ id: req.params.id, user_id: req.currentUser.id }).update({ ...req.input, updated_at: databaseNow(trx) }).returning('*');
    if (!address) fail('Address not found.', 404);
    return address;
  });
  res.json({ address });
});
router.delete('/addresses/:id', auth, async (req, res) => {
  await db.transaction(async trx => {
    const address = await trx('addresses').where({ id: req.params.id, user_id: req.currentUser.id }).forUpdate().first();
    if (!address) fail('Address not found.', 404);
    await trx('orders').where({ address_id: address.id }).update({ address_id: null });
    await trx('addresses').where({ id: address.id }).del();
  });
  res.json({ ok: true });
});
const createSchema = z.object({ idempotencyKey: uuid.optional(), customerName: text(160), paymentMethod: z.enum(['CASH_ON_DELIVERY', 'INSTAPAY_ON_DELIVERY']).default('CASH_ON_DELIVERY'), addressId: uuid.optional(), address: addressSchema.optional(), notes: optionalText(1000), items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(1).max(20), optionIds: z.array(uuid).max(30).default([]), custom: z.boolean().default(false) }).strict()).min(1).max(30) }).strict().refine(v => Boolean(v.addressId || v.address), { message: 'Address is required.' });
router.post('/orders', auth, rateLimit({ windowMs: 60000, limit: 8 }), body(createSchema), async (req, res) => res.status(201).json({ order: await orders.create(req.currentUser, req.input) }));
router.get('/orders/mine', auth, async (req, res) => res.json({ orders: await db('orders').where({ user_id: req.currentUser.id }).orderBy('created_at', 'desc').limit(100) }));
router.get('/orders/reorder', auth, async (req, res) => {
  const previous = await db('orders').where({ user_id: req.currentUser.id, status: 'DELIVERED' }).orderBy('updated_at', 'desc').first();
  if (!previous) return res.set('Cache-Control', 'no-store').json({ order: null, items: [] });
  const storedItems = await db('order_items').where({ order_id: previous.id }).orderBy('id');
  const productIds = [...new Set(storedItems.map(item => item.product_id).filter(Boolean))];
  const availableProducts = productIds.length
    ? await db('products as p').join('categories as c', 'p.category_id', 'c.id').whereIn('p.id', productIds).where({ 'p.is_available': true, 'c.is_active': true }).select('p.id')
    : [];
  const availableProductIds = new Set(availableProducts.map(product => String(product.id).toLowerCase()));
  const savedOptions = storedItems.flatMap(item => {
    try { const values = JSON.parse(item.options || '[]'); return Array.isArray(values) ? values.map(option => option?.id).filter(id => typeof id === 'string') : []; }
    catch { return []; }
  });
  const availableOptions = savedOptions.length ? await db('product_options').whereIn('id', [...new Set(savedOptions)]).where({ is_available: true }).select('id', 'product_id') : [];
  const optionProducts = new Map(availableOptions.map(option => [String(option.id).toLowerCase(), String(option.product_id).toLowerCase()]));
  const items = [];
  for (const item of storedItems) {
    if (!availableProductIds.has(String(item.product_id).toLowerCase())) continue;
    let saved = [];
    try { saved = JSON.parse(item.options || '[]'); } catch {}
    if (!Array.isArray(saved)) continue;
    const optionIds = saved.map(option => option?.id).filter(id => typeof id === 'string');
    const uniqueOptionIds = new Set(optionIds.map(id => id.toLowerCase()));
    if (optionIds.length !== saved.length || uniqueOptionIds.size !== optionIds.length || optionIds.some(id => optionProducts.get(id.toLowerCase()) !== String(item.product_id).toLowerCase())) continue;
    items.push({ productId: String(item.product_id).toLowerCase(), quantity: item.quantity, optionIds: optionIds.map(id => id.toLowerCase()), custom: item.is_custom });
  }
  res.set('Cache-Control', 'no-store').json({ order: { receiptNumber: previous.receipt_number ?? null, deliveredAt: previous.updated_at }, items });
});
router.patch('/orders/:id',auth,body(z.object({
  revision:z.string().regex(/^[a-f0-9]{64}$/),
  notes:z.string().trim().max(1000),
  items:z.array(z.object({productId:uuid,quantity:z.number().int().min(1).max(20),optionIds:z.array(uuid).max(30).default([]),custom:z.boolean().default(false)}).strict()).min(1).max(30)
}).strict()),async(req,res)=>{
  res.json({order:await orders.edit(uuid.parse(req.params.id),req.input,req.currentUser)});
});
router.get('/orders/:id', auth, async (req, res) => {
  const order = await orders.detail(req.params.id);
  if (order.user_id !== req.currentUser.id && !hasRole(req.currentUser, 'admin') && !hasRole(req.currentUser, 'kitchen') && order.assigned_driver_id !== req.currentUser.id) fail('Order not found.', 404);
  res.json({ order });
});
router.post('/orders/:id/code', auth, rateLimit({ windowMs: 60000, limit: 5 }), async (req, res) => {
  const value = await orders.issueCode(req.params.id, req.currentUser);
  res.set('Cache-Control', 'no-store').json({ ...value, qr: await QRCode.toDataURL(JSON.stringify({ orderId: req.params.id, token: value.token })) });
});
router.patch('/orders/:id/cancel', auth, async (req, res) => {
  const order = await orders.detail(req.params.id);
  if (order.user_id !== req.currentUser.id) fail('Order not found.', 404);
  res.json({ order: await orders.transition(order.id, 'CANCELLED', req.currentUser) });
});
router.get('/kitchen/orders', roles('kitchen', 'admin'), async (req, res) => {
  const pageNumber = z.coerce.number().int().min(1).max(100000).default(1);
  const requested = z.object({PLACED:pageNumber,ACCEPTED:pageNumber,PREPARING:pageNumber,READY:pageNumber}).strict().parse(req.query);
  const states = Object.keys(requested), limit = 25;
  const counts = await db('orders').whereIn('status',states).select('status').count('* as total').groupBy('status');
  const totals = Object.fromEntries(states.map(state=>[state,Number(counts.find(row=>row.status===state)?.total || 0)]));
  const pages = Object.fromEntries(states.map(state=>[state,Math.min(requested[state],Math.max(1,Math.ceil(totals[state]/limit)))]));
  const lists = await Promise.all(states.map(state=>db('orders').where({status:state}).orderBy('created_at').orderBy('id').offset((pages[state]-1)*limit).limit(limit)));
  res.json({orders:await orders.queueDetails(lists.flat()),totals,pages,limit});
});
router.patch('/kitchen/orders/:id/status', roles('kitchen', 'admin'), body(z.object({ status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'CANCELLED']) }).strict()), async (req, res) => res.json({ order: await orders.transition(req.params.id, req.input.status, req.currentUser) }));
router.get('/delivery/orders', roles('driver'), async (req, res) => {
  const input = z.object({ scope:z.enum(['all','mine','history']).default('all'), page:z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
  const query = db('orders');
  if (input.scope !== 'all') query.where({assigned_driver_id:req.currentUser.id});
  if (input.scope === 'history') query.whereIn('status',['DELIVERED','CANCELLED']);
  else query.whereNotIn('status',['DELIVERED','CANCELLED']);
  const total = Number((await query.clone().count('* as count').first()).count);
  const list = await query.orderBy('created_at',input.scope === 'history' ? 'desc' : 'asc').orderBy('id').offset((input.page-1)*50).limit(50);
  const drivers = await orders.drivers();
  res.json({ orders: (await orders.queueDetails(list)).map(order=>({...order,driver_name:drivers.find(driver=>driver.id===order.assigned_driver_id)?.name || null})), total, page:input.page, limit:50 });
});
router.patch('/delivery/orders/:id/pickup', roles('driver'), async (req, res) => res.json({ order: await orders.pickup(req.params.id, req.currentUser) }));
router.patch('/delivery/orders/:id/accept', roles('driver'), async (req,res) => {
  const id=uuid.parse(req.params.id);
  res.json({order:await orders.acceptDelivery(id,req.currentUser)});
});
const gps = z.object({ orderId: uuid, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict();
router.post('/delivery/location', roles('driver'), body(gps), async (req, res) => {
  const order = await db('orders').where({ id: req.input.orderId, assigned_driver_id: req.currentUser.id, status: 'OUT_FOR_DELIVERY' }).first();
  if (!order) fail('Active delivery not found.', 404);
  await db('driver_locations').insert({ order_id: order.id, driver_id: req.currentUser.id, latitude: req.input.latitude, longitude: req.input.longitude });
  req.app.get('io').to('order:' + order.id).to('user:' + order.user_id).emit('location', req.input);
  res.json({ ok: true });
});
router.post('/delivery/confirm', roles('driver'), rateLimit({ windowMs: 60000, limit: 5 }), body(gps.extend({ secret: z.string().min(6).max(100), paid:z.literal(true), amountReceived:z.number().min(0).max(10000000).optional() })), async (req, res) => res.json({ order: await orders.confirm(req.input, req.currentUser) }));
router.post('/push/subscribers', auth, body(z.object({ subscriptionId: text(120) }).strict()), async (req, res) => {
  await upsert(db, 'push_subscribers', { onesignal_subscription_id: req.input.subscriptionId }, { user_id: req.currentUser.id, external_id: req.currentUser.id }, { user_id: req.currentUser.id, external_id: req.currentUser.id });
  res.json({ ok: true });
});
const productSchema = z.object({ category_id: uuid, name: text(120), name_ar: text(160), slug: z.string().regex(/^[a-z0-9-]+$/).max(120), description: optionalText(2000), description_ar: optionalText(2000), price_egp: z.number().int().positive().max(100000), sale_price_egp: z.number().int().positive().max(100000).nullable().default(null), send_offer_notification: z.boolean().default(false), image_url: z.string().max(2000).refine(value=>!value||media.validImage(value),'Choose an image uploaded to this site.').default(''), ingredients: z.array(text(100)).max(30).default([]), is_available: z.boolean().default(true), is_featured: z.boolean().default(false), prep_minutes: z.number().int().min(5).max(120).default(20) }).strict().refine(product => product.sale_price_egp === null || product.sale_price_egp < product.price_egp, { path: ['sale_price_egp'], message: 'Offer price must be lower than the regular price.' });
router.use('/admin', roles('admin'));
router.use('/admin/content', require('./content'));
router.get('/admin/overview', async (req, res) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  const [products, activeOrders, staff, sales] = await Promise.all([
    db('products').where({ is_available: true }).count('* as total').first(),
    db('orders').whereNotIn('status', ['DELIVERED', 'CANCELLED']).count('* as total').first(),
    db('users').where({ is_active: true }).whereExists(function () {
      this.select('*').from('user_roles').whereRaw('user_roles.user_id = users.id').whereIn('role', ['admin', 'kitchen', 'driver']);
    }).count('* as total').first(),
    dateRange(db('orders').where({status:'DELIVERED'}),db,'created_at',today,today).sum('total_egp as revenue').first()
  ]);
  res.json({ products: Number(products.total), activeOrders: Number(activeOrders.total), staff: Number(staff.total), revenue: Number(sales.revenue || 0), date: today });
});
router.get('/admin/products', async (req, res) => res.json({ products: await db('products').orderBy('name'), categories: await db('categories').orderBy('name') }));
router.get('/admin/uploads/test', async (req, res) => {
  const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  res.json({ configured, cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing', has_api_key: Boolean(process.env.CLOUDINARY_API_KEY), has_secret: Boolean(process.env.CLOUDINARY_API_SECRET) });
});
router.post('/admin/uploads', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }), async (req, res) => {
  const mime = req.get('content-type')?.split(';')[0].trim().toLowerCase();
  const buffer = req.body;
  const valid = Buffer.isBuffer(buffer) && buffer.length > 0 && (
    (mime === 'image/jpeg' && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mime === 'image/png' && buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mime === 'image/webp' && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
  );
  if (!valid) return res.status(415).json({ message: 'Choose a valid JPG, PNG or WebP image.' });
  if (!media.configured()) {
    if (process.env.VERCEL) return res.status(503).json({ message: 'Cloudinary not configured on server. Check CLOUDINARY environment variables in Vercel dashboard.' });
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    const directory = path.resolve(__dirname, '../../public/uploads');
    const filename = `${randomUUID()}.${extension}`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
    return res.status(201).json({ image_url: `/uploads/${filename}` });
  }
  try {
    const result = await media.upload(buffer);
    return res.status(201).json({ image_url: result.secure_url });
  } catch (error) {
    console.error('[upload]', error.message);
    return res.status(502).json({ message: 'Cloudinary upload failed: ' + error.message });
  }
});
router.post('/admin/products', body(productSchema), async (req, res) => {
  const { send_offer_notification, ...productInput } = req.input;
  const product = (await db('products').insert({ ...productInput, ingredients: JSON.stringify(productInput.ingredients) }).returning('*'))[0];
  const notification = send_offer_notification && product.sale_price_egp != null ? await notifications.offer(product) : null;
  res.status(201).json({ product, notification });
});
router.put('/admin/products/:id', body(productSchema), async (req, res) => {
  const { send_offer_notification, ...productInput } = req.input;
  const existing = await db('products').where({ id: req.params.id }).first();
  if (!existing) fail('Product not found.', 404);
  const [product] = await db('products').where({ id: req.params.id }).update({ ...productInput, ingredients: JSON.stringify(productInput.ingredients), updated_at: databaseNow(db) }).returning('*');
  if (!product) fail('Product not found.', 404);
  const offerChanged = product.sale_price_egp != null && Number(existing.sale_price_egp) !== Number(product.sale_price_egp);
  const notification = send_offer_notification && offerChanged ? await notifications.offer(product) : null;
  res.json({ product, notification });
});
router.delete('/admin/products/:id', async (req, res) => {
  await db.transaction(async trx => {
    const product = await trx('products').where({ id: req.params.id }).forUpdate().first();
    if (!product) fail('Product not found.', 404);
    await trx('order_items').where({ product_id: product.id }).update({ product_id: null });
    await trx('product_options').where({ product_id: product.id }).del();
    await trx('products').where({ id: product.id }).del();
  });
  res.json({ ok: true });
});
router.get('/admin/users', async (req, res) => {
  const users = await db('users').select('id', 'email', 'name', 'role', 'is_active').orderBy('name');
  const assignments = await db('user_roles').select('user_id', 'role');
  const rolesByUser = new Map();
  for (const assignment of assignments) rolesByUser.set(assignment.user_id, [...(rolesByUser.get(assignment.user_id) || []), assignment.role]);
  res.json({ users: users.map(user => ({ ...user, roles: rolesByUser.get(user.id) || [user.role] })) });
});
const roleList = z.array(z.enum(ROLE_VALUES)).min(1).max(ROLE_VALUES.length).transform(values => [...new Set(values)]);
router.post('/admin/users', body(z.object({ email: z.email().max(254), name: text(160), roles: roleList }).strict()), async (req, res) => {
  const email = req.input.email.trim().toLowerCase();
  const roles = req.input.roles;
  if (email === req.currentUser.email.toLowerCase() && !roles.includes('admin')) fail('You cannot remove your own administrator access.');
  const result = await db.transaction(async trx => {
    const existing = await trx('users').whereRaw('LOWER(email) = ?', [email]).first();
    if (existing) {
      const [updated] = await trx('users').where({ id: existing.id }).update({ name: req.input.name, role: primaryRole(roles), is_active: true, updated_at: databaseNow(db) }).returning(['id', 'email', 'name', 'role', 'is_active']);
      await replaceUserRoles(trx, updated.id, roles);
      return { user: { ...updated, roles }, created: false };
    }
    const [created] = await trx('users').insert({ email, name: req.input.name, role: primaryRole(roles) }).returning(['id', 'email', 'name', 'role', 'is_active']);
    await replaceUserRoles(trx, created.id, roles);
    return { user: { ...created, roles }, created: true };
  });
  req.app.get('io').in('user:' + result.user.id).disconnectSockets(true);
  res.status(result.created ? 201 : 200).json(result);
});
router.patch('/admin/users/:id', body(z.object({ roles: roleList, is_active: z.boolean() }).strict()), async (req, res) => {
  const roles = req.input.roles;
  if (req.params.id === req.currentUser.id && (!roles.includes('admin') || !req.input.is_active)) fail('You cannot remove your own administrator access.');
  const user = await db.transaction(async trx => {
    const [updated] = await trx('users').where({ id: req.params.id }).update({ role: primaryRole(roles), is_active: req.input.is_active, updated_at: databaseNow(db) }).returning(['id', 'email', 'name', 'role', 'is_active']);
    if (!updated) fail('User not found.', 404);
    await replaceUserRoles(trx, updated.id, roles);
    return { ...updated, roles };
  });
  req.app.get('io').in('user:' + user.id).disconnectSockets(true);
  res.json({ user });
});
router.get('/admin/orders', async (req, res) => {
  const drivers = await orders.drivers();
  res.json({ orders: await db('orders').orderBy('created_at', 'desc').limit(100), drivers });
});
router.get('/admin/report', async (req, res) => res.json(await businessReports.report(req.query)));
router.patch('/admin/orders/:id/assign', body(z.object({ driverId: uuid }).strict()), async (req, res) => res.json({ order: await orders.assign(req.params.id, req.input.driverId) }));
router.get('/admin/sales', async (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date()));
  const row = await dateRange(db('orders'),db,'created_at',date,date).select(db.raw("COUNT(*) as orders, COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN total_egp ELSE 0 END), 0) as revenue, COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) as cancelled")).first();
  res.json({ date, ...row });
});
module.exports = router;
