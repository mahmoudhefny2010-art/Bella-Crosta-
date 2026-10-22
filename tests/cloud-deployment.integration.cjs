const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
require('dotenv').config({quiet:true});
const schema='bella_test_'+crypto.randomBytes(8).toString('hex');
process.env.NODE_ENV='test';process.env.DB_PROVIDER='postgres';process.env.BELLA_TEST_SCHEMA=schema;
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');process.env.ONESIGNAL_APP_ID='';process.env.ONESIGNAL_REST_API_KEY='';process.env.VERCEL='1';
const knex=require('knex'),{config}=require('../server/db/postgres-config');
const adminDb=knex({...config(undefined,{direct:true}),searchPath:['public']});
const actors={};let db,server,browser,created=false,base;const uploads=[];
async function request(route,actor='customer',method='GET',body,expected=200){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(actors[actor]?{Cookie:'bella_session='+actors[actor].token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json().catch(()=>({}));assert.equal(response.status,expected,route+': '+JSON.stringify(result));return result;
}
async function main(){
  assert.match(schema,/^bella_test_[a-f0-9]{16}$/);
  await adminDb.raw('CREATE SCHEMA ??',[schema]);created=true;
  db=require('../server/db');await db.migrate.latest();await db.seed.run();
  const {signInToken}=require('../server/middleware/session');
  for(const [name,roles] of Object.entries({customer:['customer'],other:['customer'],admin:['admin'],owner:['owner'],kitchen:['kitchen'],driver:['driver'],driver2:['driver']})){
    const [user]=await db('users').insert({email:name+'@example.org',name,role:roles[0]}).returning('*');await db('user_roles').insert(roles.map(role=>({user_id:user.id,role})));actors[name]={...user,token:signInToken(user)};
  }
  ({server}=require('../server/app'));process.env.GOOGLE_MAPS_API_KEY='';
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  await request('/api/owner/orders','other','GET',undefined,403);await request('/api/admin/content','owner','GET',undefined,403);await request('/api/delivery/orders','other','GET',undefined,403);
  const configData=await request('/api/config');assert.equal(configData.realtimeMode,'poll');
  const menu=await request('/api/menu'),product=menu.products.find(product=>product.slug==='margherita');assert.ok(product);
  const address={label:'Test',address_line:'Test street 1',landmark:'',floor:'1',apartment:'2',phone:'01031252519',latitude:30.0444,longitude:31.2357,is_default:false};
  const input={customerName:'Test customer',address,items:[{productId:product.id,quantity:1,optionIds:[],custom:false}],notes:'',idempotencyKey:crypto.randomUUID()};
  const [first,retry]=await Promise.all([request('/api/orders','customer','POST',input,201),request('/api/orders','customer','POST',input,201)]);assert.equal(first.order.id,retry.order.id);assert.equal(Number((await db('orders').count('* as count').first()).count),1);
  const order=first.order;assert.ok(order.receipt_number);assert.ok(order.edit_revision);
  await request('/api/orders/'+order.id,'other','PATCH',{revision:order.edit_revision,notes:'bad',items:input.items},404);
  const changed=await request('/api/orders/'+order.id,'customer','PATCH',{revision:order.edit_revision,notes:'No onions',items:[{...input.items[0],quantity:2}]});assert.equal(changed.order.total_egp,product.price_egp*2+configData.deliveryFee);assert.equal(changed.order.receipt_number,order.receipt_number);
  await request('/api/orders/'+order.id,'customer','PATCH',{revision:order.edit_revision,notes:'stale',items:input.items},409);
  const claim=await Promise.all(['driver','driver2'].map(actor=>fetch(base+'/api/delivery/orders/'+order.id+'/accept',{method:'PATCH',headers:{Cookie:'bella_session='+actors[actor].token}}).then(response=>response.status)));assert.deepEqual(claim.sort(),[200,409]);
  await request('/api/owner/orders/'+order.id+'/assign','owner','PATCH',{driverId:actors.driver.id});
  for(const status of ['ACCEPTED','PREPARING','READY'])await request('/api/kitchen/orders/'+order.id+'/status','kitchen','PATCH',{status});
  await request('/api/orders/'+order.id,'customer','PATCH',{revision:changed.order.edit_revision,notes:'late',items:input.items},409);
  const kitchen=await request('/api/kitchen/orders','kitchen');assert.equal(kitchen.totals.READY,1);assert.equal(kitchen.limit,25);
  await request('/api/delivery/orders/'+order.id+'/pickup','driver','PATCH');
  await request('/api/owner/orders/'+order.id+'/assign','owner','PATCH',{driverId:actors.driver2.id});
  const code=await request('/api/orders/'+order.id+'/code','customer','POST',{});
  const gps={orderId:order.id,secret:code.code,latitude:30.0444,longitude:31.2357,paid:true,amountReceived:changed.order.total_egp+100};
  await request('/api/delivery/confirm','driver','POST',gps,403);
  await request('/api/delivery/confirm','driver2','POST',{...gps,amountReceived:1},400);
  const completed=await request('/api/delivery/confirm','driver2','POST',gps);assert.equal(completed.order.payment_status,'PAID');assert.equal(completed.order.change_due_egp,100);await request('/api/delivery/confirm','driver2','POST',gps,409);
  const live=await request('/api/live?watch='+order.id);assert.equal(live.tracked.status,'DELIVERED');assert.ok(live.version);assert.ok(live.location);
  const ownerOrders=await request('/api/owner/orders?search='+encodeURIComponent('#'+order.receipt_number),'owner');assert.equal(ownerOrders.total,1);assert.equal(ownerOrders.orders[0].payment_status,'PAID');
  const analytics=await request('/api/owner/analytics','owner');assert.equal(analytics.summary.delivered,1);
  const exportResponse=await fetch(base+'/api/owner/export',{headers:{Cookie:'bella_session='+actors.owner.token}});assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-type'),/spreadsheetml/);const workbook=Buffer.from(await exportResponse.arrayBuffer());assert.ok(workbook.includes(Buffer.from('PAID')));assert.ok(workbook.includes(Buffer.from('#'+order.receipt_number)));
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=','base64');
  const upload=await fetch(base+'/api/admin/uploads',{method:'POST',headers:{Cookie:'bella_session='+actors.admin.token,'Content-Type':'image/png'},body:png});const image=await upload.json();assert.equal(upload.status,201,JSON.stringify(image));assert.match(image.image_url,/^https:\/\/res\.cloudinary\.com\//);uploads.push(image.image_url);
  await request('/api/admin/content','admin','PUT',{entries:[{key:'asset.hero',en:image.image_url,ar:image.image_url},{key:'hero.title',en:'Cloud test title',ar:'عنوان تجريبي'}]});
  await request('/api/admin/content','admin','PUT',{entries:[{key:'asset.hero',en:'https://evil.example/image.png',ar:'https://evil.example/image.png'}]},400);
  const pageResponse=await fetch(base+'/');assert.match(pageResponse.headers.get('content-security-policy'),/res.cloudinary.com/);
  const newOrder=await request('/api/orders','customer','POST',{...input,idempotencyKey:crypto.randomUUID()},201);
  const {chromium}=require('playwright');browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[];
  await context.addInitScript(()=>{localStorage.setItem('bella_theme','light');localStorage.setItem('bella_app_installed','1');});await context.addCookies([{name:'bella_session',value:actors.customer.token,url:base}]);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/');await page.waitForSelector('.hero h1');assert.match(await page.locator('.hero h1').innerText(),/Cloud test title/);
  await page.goto(base+'/track?id='+newOrder.order.id);await page.locator('#edit-order').click();await page.waitForSelector('[data-order-edit][open]');await page.locator('[data-quantity]').fill('3');await page.locator('[data-quantity]').press('Tab');await page.locator('[data-order-edit] [type=submit]').click();await page.waitForSelector('[data-order-edit]',{state:'detached'});assert.equal((await request('/api/orders/'+newOrder.order.id)).order.items[0].quantity,3);
  await context.clearCookies();await context.addCookies([{name:'bella_session',value:actors.admin.token,url:base}]);await page.goto(base+'/admin?tab=content');await page.waitForSelector('[data-content-form]');await page.locator('.content-section-nav button').filter({hasText:/^Hero$/}).click();await page.locator('[data-key="hero.title"] [name="en"]').fill('Saved in cloud editor');await page.locator('.content-group:not([hidden]) [type=submit]').click();await page.locator('.content-group:not([hidden]) [data-save-state]').filter({hasText:'Section saved.'}).waitFor();
  await fs.mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/cloud-admin-content.png',fullPage:true});
  await context.clearCookies();await context.addCookies([{name:'bella_session',value:actors.owner.token,url:base}]);
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.goto(base+'/owner?tab=analytics');await page.waitForSelector('.owner-metrics');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'artifacts/cloud-owner-'+width+'.png',fullPage:true});}
  await context.clearCookies();await context.addCookies([{name:'bella_session',value:actors.driver.token,url:base}]);await page.goto(base+'/delivery');await page.waitForSelector('[data-accept]');await page.locator('[data-accept]').first().click();await page.waitForSelector('[data-accept]',{state:'detached'});
  await context.close();assert.deepEqual(errors,[]);
  console.log('PASS: isolated PostgreSQL migrations/seeds, role restrictions, duplicate checkout, receipt numbers, customer edits, driver acceptance races, owner reassignment, kitchen pagination, QR/payment/change, reports/XLSX, database realtime, real Cloudinary upload, safe image URLs, desktop/mobile browser workflows.');
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));server.emit('close');}if(db)await db.destroy();
  for(const url of uploads){const match=new URL(url).pathname.match(/\/image\/upload\/v\d+\/(bella-crosta\/[A-Za-z0-9_-]+)\.[a-z]+$/);if(match)await require('../server/services/media').client().uploader.destroy(match[1]);}
  if(created){assert.match(schema,/^bella_test_[a-f0-9]{16}$/);await adminDb.raw('DROP SCHEMA ?? CASCADE',[schema]);console.log('Removed only the isolated test schema and its uploaded image. Live application data unchanged.');}await adminDb.destroy();
});
