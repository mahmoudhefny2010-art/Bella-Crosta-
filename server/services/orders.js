const {now:databaseNow}=require('../db/dialect');
const crypto = require('node:crypto');
const db = require('../db');
const { fail, assertTransition, credentials, assertDelivery } = require('./workflow');
const { createPayment } = require('./payments');
const {requestLock}=require('../db/dialect');
const inEgypt = require('./egypt');
let publish = async () => {};
function setPublisher(fn) { publish = fn; }
function editRevision(order) {
  return crypto.createHash('sha256').update(JSON.stringify({status:order.status,notes:order.notes,total:order.total_egp,events:order.events.map(event=>event.id).sort(),items:[...order.items].sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');
}
async function detail(id, trx = db) {
  const order = await trx('orders').where({ id }).first();
  if (!order) fail('Order not found.', 404);
  order.items = await trx('order_items').where({ order_id: id });
  order.events = await trx('order_events').where({ order_id: id }).orderBy('created_at');
  order.location = await trx('driver_locations').where({ order_id: id }).orderBy('recorded_at', 'desc').first();
  order.edit_revision = editRevision(order);
  return order;
}
// Queue views need item details, not a separate items/events/GPS query per order.
async function queueDetails(list) {
  if (!list.length) return [];
  const items = await db('order_items').whereIn('order_id', list.map(order => order.id));
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.order_id)) grouped.set(item.order_id, []);
    grouped.get(item.order_id).push(item);
  }
  return list.map(order => ({...order, items:grouped.get(order.id) || []}));
}
async function priceItems(trx,items) {
    const productIds = [...new Set(items.map(item=>item.productId))];
    const optionIds = [...new Set(items.flatMap(item=>item.optionIds || []))];
    const productRows = await trx('products').whereIn('id',productIds).where({is_available:true});
    const productMap = new Map(productRows.map(product=>[product.id,product]));
    const optionRows = optionIds.length ? await trx('product_options').whereIn('id',optionIds).where({is_available:true}) : [];
    const optionMap = new Map(optionRows.map(option=>[option.id,option]));
    const lines = [];
    for (const item of items) {
      const product = productMap.get(item.productId.toLowerCase());
      if (!product) fail('A pizza is no longer available.', 409);
      const ids = [...new Set(item.optionIds || [])];
      const options = ids.map(id=>optionMap.get(id.toLowerCase())).filter(option=>option && option.product_id === product.id);
      if (options.length !== ids.length) fail('Invalid product options.');
      if (!item.custom && options.some(o => o.option_group === 'sauce')) fail('Sauce options require a custom pizza.');
      if (item.custom && options.filter(o => o.option_group === 'sauce').length !== 1) fail('Choose exactly one sauce.');
      const unit = (product.sale_price_egp ?? product.price_egp) + options.reduce((sum, o) => sum + o.price_delta_egp, 0);
      lines.push({ product_id: product.id, product_name: item.custom ? 'Custom ' + product.name : product.name, product_name_ar: item.custom ? 'بيتزا مخصصة: ' + product.name_ar : product.name_ar, quantity: item.quantity, unit_price_egp: unit, line_total_egp: unit * item.quantity, options: JSON.stringify(options.map(o => ({ id: o.id, group: o.option_group, name: o.name, name_ar: o.name_ar, price: o.price_delta_egp }))), is_custom: item.custom });
    }
    return lines;
}
async function create(user, input) {
  const result = await db.transaction(async trx => {
    const requestKey = input.idempotencyKey;
    const {idempotencyKey, ...requestBody} = input;
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');
    if (requestKey) {
      await requestLock(trx,'checkout:'+user.id+':'+requestKey);
      const previous = await trx('order_requests').where({user_id:user.id,request_key:requestKey}).first();
      if (previous) {
        if (previous.request_hash !== requestHash) fail('This checkout request was already used for different order details.',409);
        return {...await trx('orders').where({id:previous.order_id}).first(), replayed:true};
      }
    }
    let address = input.fulfillmentType === 'PICKUP' ? undefined : input.address;
    let addressId = input.fulfillmentType === 'PICKUP' ? undefined : input.addressId;
    if (input.fulfillmentType === 'DELIVERY') {
      if (input.addressId) address = await trx('addresses').where({ id: input.addressId, user_id: user.id }).first();
      if (!address) fail('Select or enter a delivery address.');
      if (!inEgypt(Number(address.latitude), Number(address.longitude))) fail('Please choose a location inside Egypt.');
    }
    const lines = await priceItems(trx,input.items);
    const subtotal = lines.reduce((sum, line) => sum + line.line_total_egp, 0);
    const operation = await require('./site-content').operational(trx);
    if (!operation.acceptOrders) fail(operation.closedMessage, 409);
    const delivery = input.fulfillmentType === 'DELIVERY' ? operation.deliveryFee : 0;
    const [order] = await trx('orders').insert({ order_number: 'BC-' + crypto.randomBytes(6).toString('hex').toUpperCase(), user_id: user.id, address_id: addressId || null, address_snapshot: input.fulfillmentType === 'PICKUP' ? JSON.stringify({ label: 'Pickup', address_line: 'Bella Crosta Store' }) : JSON.stringify(address), customer_name: input.customerName, payment_status:'UNPAID', payment_method: input.paymentMethod || 'CASH_ON_DELIVERY', customer_phone: address?.phone || '', subtotal_egp: subtotal, delivery_fee_egp: delivery, total_egp: subtotal + delivery, notes: input.notes || '', fulfillment_type: input.fulfillmentType || 'DELIVERY' }).returning('*');
    await trx('order_items').insert(lines.map(line => ({ ...line, order_id: order.id })));
    await trx('order_events').insert({ order_id: order.id, status: 'PLACED', actor_id: user.id });
    await createPayment(order);
    if (requestKey) await trx('order_requests').insert({user_id:user.id,request_key:requestKey,request_hash:requestHash,order_id:order.id});
    return order;
  });
  if (!result.replayed) await publish(result);
  return detail(result.id);
}
async function transition(id, to, actor) {
  const order = await db.transaction(async trx => {
    const order = await trx('orders').where({ id }).forUpdate().first();
    if (!order) fail('Order not found.', 404);
    assertTransition(order.status, to);
    if (to === 'OUT_FOR_DELIVERY') fail('Use the driver pickup endpoint.');
    if (to === 'DELIVERED') fail('Delivery requires the customer code.');
    await trx('orders').where({ id }).update({ status: to, updated_at: databaseNow(trx) });
    await trx('order_events').insert({ order_id: id, status: to, actor_id: actor.id });
    return { ...order, status: to };
  });
  await publish(order);
  return detail(id);
}
async function edit(id,input,customer) {
  const changed = await db.transaction(async trx=>{
    const locked=await trx('orders').where({id,user_id:customer.id}).forUpdate().first();
    if(!locked)fail('Order not found.',404);
    if(locked.status!=='PLACED')fail('The kitchen has already accepted this order. It can no longer be edited.',409);
    if(locked.payment_status==='PAID')fail('A paid order cannot be edited.',409);
    const current=await detail(id,trx);
    if(current.edit_revision!==input.revision)fail('This order has changed. Reload it before editing again.',409);
    const lines=await priceItems(trx,input.items);
    const subtotal=lines.reduce((sum,line)=>sum+line.line_total_egp,0);
    await trx('order_items').where({order_id:id}).del();
    await trx('order_items').insert(lines.map(line=>({...line,order_id:id})));
    const [updated]=await trx('orders').where({id}).update({notes:input.notes,subtotal_egp:subtotal,total_egp:subtotal+Number(locked.delivery_fee_egp),updated_at:databaseNow(trx)}).returning('*');
    await trx('order_events').insert({order_id:id,status:'PLACED',actor_id:customer.id,note:'Customer edited order before kitchen acceptance'});
    return updated;
  });
  await publish(changed,{notify:false});
  return detail(id);
}
async function pickup(id, driver) {
  const order = await db.transaction(async trx => {
    const order = await trx('orders').where({ id }).forUpdate().first();
    if (!order || order.assigned_driver_id !== driver.id) fail('Order is not assigned to you.', 403);
    if (order.fulfillment_type === 'PICKUP') fail('Pickup orders cannot be delivered.', 409);
    assertTransition(order.status, 'OUT_FOR_DELIVERY');
    // A token is issued when the customer opens tracking, then retained only by that browser.
    const credential = credentials();
    await trx('delivery_tokens').insert({ order_id: id, token_hash: credential.token_hash, manual_code_hash: credential.manual_code_hash, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    await trx('orders').where({ id }).update({ status: 'OUT_FOR_DELIVERY', updated_at: databaseNow(trx) });
    await trx('order_events').insert({ order_id: id, status: 'OUT_FOR_DELIVERY', actor_id: driver.id });
    return { ...order, status: 'OUT_FOR_DELIVERY' };
  });
  await publish(order);
  return detail(id);
}
async function issueCode(id, user) {
  return db.transaction(async trx => {
    const order = await trx('orders').where({ id }).forUpdate().first();
    if (!order || order.user_id !== user.id) fail('Order not found.', 404);
    if (order.status !== 'OUT_FOR_DELIVERY') fail('Delivery code becomes available after pickup.', 409);
    // Reissuing explicitly invalidates previous codes; plaintext credentials are never persisted.
    await trx('delivery_tokens').where({ order_id: id }).whereNull('used_at').update({ used_at: databaseNow(trx) });
    const value = credentials();
    await trx('delivery_tokens').insert({ order_id: id, token_hash: value.token_hash, manual_code_hash: value.manual_code_hash, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    return { token: value.token, code: value.code };
  });
}
async function confirm(input, driver) {
  const order = await db.transaction(async trx => {
    const order = await trx('orders').where({ id: input.orderId }).forUpdate().first();
    if (!order) fail('Order not found.', 404);
    const token = await trx('delivery_tokens').where({ order_id: order.id }).whereNull('used_at').orderBy('created_at', 'desc').first();
    assertDelivery({ order, token, driverId: driver.id, secret: input.secret });
    if (input.paid !== true) fail('Confirm payment received before completing delivery.');
    const received = order.payment_method === 'CASH_ON_DELIVERY' ? input.amountReceived : Number(order.total_egp);
    if (typeof received !== 'number' || !Number.isFinite(received) || received < Number(order.total_egp) || received > 10000000 || Math.abs(received * 100 - Math.round(received * 100)) > 0.000001) fail('Enter a valid received amount covering the order total.');
    const change = (Math.round(received * 100) - Math.round(Number(order.total_egp) * 100)) / 100;
    await trx('delivery_tokens').where({ order_id: order.id }).whereNull('used_at').update({ used_at: databaseNow(trx) });
    await trx('orders').where({ id: order.id }).update({ status: 'DELIVERED', payment_status:'PAID', amount_received_egp:received, change_due_egp:change, paid_by:driver.id, paid_at:databaseNow(trx), updated_at: databaseNow(trx) });
    await trx('order_events').insert({ order_id: order.id, status: 'DELIVERED', actor_id: driver.id });
    await trx('driver_locations').insert({ order_id: order.id, driver_id: driver.id, latitude: input.latitude, longitude: input.longitude });
    return { ...order, status: 'DELIVERED', payment_status:'PAID', amount_received_egp:received, change_due_egp:change };
  });
  await publish(order);
  return detail(order.id);
}
async function drivers() {
  return db('users').where({ is_active: true }).whereExists(function () { this.select('*').from('user_roles').whereRaw('user_roles.user_id = users.id').where({ role: 'driver' }); }).select('id', 'name').orderBy('name');
}
async function acceptDelivery(id, driver) {
  const order = await db.transaction(async trx => {
    const order = await trx('orders').where({id}).forUpdate().first();
    if (!order) fail('Order not found.',404);
    if (order.fulfillment_type === 'PICKUP') fail('Pickup orders cannot be assigned to a driver.',409);
    if (!['PLACED','ACCEPTED','PREPARING','READY'].includes(order.status)) fail('This order is no longer available to accept.',409);
    if (order.assigned_driver_id === driver.id) return order;
    if (order.assigned_driver_id) fail('Another driver is already assigned to this order.',409);
    const [updated] = await trx('orders').where({id}).whereNull('assigned_driver_id').update({assigned_driver_id:driver.id,updated_at:databaseNow(trx)}).returning('*');
    if (!updated) fail('Another driver has already accepted this order.',409);
    await trx('order_events').insert({order_id:id,status:order.status,actor_id:driver.id,note:'Delivery accepted by driver'});
    return updated;
  });
  await publish(order,{notify:false});
  return order;
}
async function assign(id, driverId) {
  const order = await db.transaction(async trx => {
    const driver = await trx('users').where({ id: driverId, is_active: true }).whereExists(function () { this.select('*').from('user_roles').whereRaw('user_roles.user_id = users.id').where({ role: 'driver' }); }).first();
    if (!driver) fail('Driver not found.', 404);
    const order = await trx('orders').where({ id }).forUpdate().first();
    if (!order || order.fulfillment_type === 'PICKUP' || !['PLACED','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY'].includes(order.status)) fail('Order is not available for assignment.', 409);
    const [updated] = await trx('orders').where({ id }).update({ assigned_driver_id: driverId, updated_at: databaseNow(trx) }).returning('*');
    return updated;
  });
  await publish(order, { notify: false });
  return order;
}
async function collect(id, actor) {
  const order = await db.transaction(async trx => {
    const order = await trx('orders').where({id}).forUpdate().first();
    if (!order) fail('Order not found.',404);
    if (order.fulfillment_type !== 'PICKUP' || order.status !== 'READY') fail('Only ready pickup orders can be collected.',409);
    const update = {status:'DELIVERED',payment_status:'PAID',amount_received_egp:Number(order.total_egp),change_due_egp:0,paid_by:actor.id,paid_at:databaseNow(trx),updated_at:databaseNow(trx)};
    await trx('orders').where({id}).update(update);
    await trx('order_events').insert({order_id:id,status:'DELIVERED',actor_id:actor.id,note:'Collected by customer; cashier confirmed payment'});
    return {...order,...update};
  });
  await publish(order);
  return detail(id);
}
module.exports = { collect, create, edit, detail, queueDetails, transition, pickup, issueCode, confirm, setPublisher, drivers, assign, acceptDelivery };
