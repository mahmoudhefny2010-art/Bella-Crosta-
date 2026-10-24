require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');const crypto=require('node:crypto');const db=require('../server/db');const orders=require('../server/services/orders');
const users=[];let orderId;
(async()=>{try{
 for(const role of ['customer','kitchen','driver']){const [u]=await db('users').insert({name:'Pickup regression',email:crypto.randomUUID()+'@example.invalid',role}).returning('*');users.push(u);}
 const product=await db('products').where({is_available:true}).first();assert.ok(product);
 const input={idempotencyKey:crypto.randomUUID(),customerName:'Pickup regression',fulfillmentType:'PICKUP',paymentMethod:'PAY_AT_CASHIER',items:[{productId:product.id,quantity:1,optionIds:[],custom:false}]};
 const created=await orders.create(users[0],input);orderId=created.id;
 assert.equal(created.address_id,null);assert.equal(Number(created.delivery_fee_egp),0);assert.equal(created.payment_method,'PAY_AT_CASHIER');
 assert.equal((await orders.create(users[0],input)).id,orderId);
 await assert.rejects(()=>orders.collect(orderId,users[1]));
 await assert.rejects(()=>orders.acceptDelivery(orderId,users[2]));
 await assert.rejects(()=>orders.assign(orderId,users[2].id));
 for(const status of ['ACCEPTED','PREPARING','READY'])await orders.transition(orderId,status,users[1]);
 const done=await orders.collect(orderId,users[1]);assert.equal(done.status,'DELIVERED');assert.equal(done.payment_status,'PAID');assert.equal(Number(done.amount_received_egp),Number(done.total_egp));
 await assert.rejects(()=>orders.collect(orderId,users[1]));console.log('Pickup creation, retry, driver exclusion, preparation, cashier payment and collection PASS');
 }finally{if(orderId){for(const table of ['order_requests','delivery_tokens','driver_locations','order_events','order_items'])await db(table).where({order_id:orderId}).del();await db('orders').where({id:orderId}).del();}if(users.length)await db('users').whereIn('id',users.map(u=>u.id)).del();await db.destroy();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
