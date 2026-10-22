// Runs against an isolated, randomly named SQL Server database; never uses live business records.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const knex = require('knex');
require('dotenv').config({quiet:true});
const testName = 'bella_feature_test_' + crypto.randomBytes(8).toString('hex');
const originalName = process.env.SQLSERVER_DATABASE || 'bella_crosta';
const configModule = require.resolve('../server/db/sqlserver-config');
const initialConfig = require(configModule).development;
const masterConnection = initialConfig.connection.connectionString
  ? { connectionString: initialConfig.connection.connectionString.replace(/Database=\{(?:[^}]|}})*\};/, 'Database={master};') }
  : {...initialConfig.connection,database:'master'};
const master = knex({...initialConfig,connection:masterConnection});
const base = 'http://127.0.0.1:4031';
const uploaded = [];
let db, server, ioServer, ownerSocket, browser, createdDatabase = false;
const actors = {};
function unzip(buffer) {
  const files = {}; let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset+8),0,'Workbook uses uncompressed ZIP entries');
    const size=buffer.readUInt32LE(offset+18), nameLength=buffer.readUInt16LE(offset+26), extraLength=buffer.readUInt16LE(offset+28);
    const name=buffer.subarray(offset+30,offset+30+nameLength).toString('utf8'), start=offset+30+nameLength+extraLength;
    files[name]=buffer.subarray(start,start+size).toString('utf8'); offset=start+size;
  }
  return files;
}
async function request(route, actor='admin', method='GET', body, expected=200) {
  const response = await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(actors[actor] ? {Cookie:'bella_session='+actors[actor].token} : {})},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const result = await response.json().catch(()=>({}));
  assert.equal(response.status,expected,route+': '+JSON.stringify(result)); return result;
}
async function save(entries, expected=200) { return request('/api/admin/content','admin','PUT',{entries},expected); }
const shared = (key,value) => ({key,en:String(value),ar:String(value)});
async function run() {
  assert.notEqual(testName,originalName); assert.match(testName,/^bella_feature_test_[a-f0-9]{16}$/);
  await master.raw('CREATE DATABASE ??',[testName]); createdDatabase=true;
  process.env.SQLSERVER_DATABASE=testName; delete require.cache[configModule];
  process.env.NODE_ENV='development'; process.env.APP_URL=base; process.env.CORS_ORIGINS=base;
  process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex'); process.env.ONESIGNAL_APP_ID=''; process.env.ONESIGNAL_REST_API_KEY='';
  db=require('../server/db');
  const [identity]=await db.raw('SELECT DB_NAME() as name'); assert.equal(identity.name,testName);
  await db.migrate.latest(); await db.seed.run();
  const {signInToken}=require('../server/middleware/session');
  for (const [name,role,is_active] of [['admin','admin',true],['owner','owner',true],['customer','customer',true],['other','customer',true],['kitchen','kitchen',true],['driver','driver',true],['otherDriver','driver',true],['inactiveDriver','driver',false]]) {
    const [user]=await db('users').insert({name:'Feature '+name,email:crypto.randomUUID()+'@example.invalid',role,is_active}).returning('*');
    await db('user_roles').insert({user_id:user.id,role}); actors[name]={...user,token:signInToken(user)};
  }
  const application=require('../server/app'); server=application.server; ioServer=application.app.get('io');
  process.env.GOOGLE_MAPS_API_KEY=''; process.env.GOOGLE_MAPS_MAP_ID='';
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4031,'127.0.0.1',resolve);});
  assert.equal((await request('/api/health','anonymous')).ok,true);
  for (const role of ['anonymous','customer','kitchen','driver','admin']) await request('/api/owner/orders',role,'GET',undefined,role==='anonymous'?401:403);
  for (const route of ['/api/admin/content','/api/admin/content/media','/api/admin/users','/api/admin/products']) await request(route,'owner','GET',undefined,403);
  await request('/api/admin/content','owner','PUT',{entries:[]},403);
  await request('/api/admin/users/'+actors.owner.id,'owner','PATCH',{roles:['owner','admin'],is_active:true},403);
  assert.equal((await fetch(base+'/admin',{headers:{Cookie:'bella_session='+actors.owner.token}})).status,403);
  assert.equal((await fetch(base+'/owner',{headers:{Cookie:'bella_session='+actors.admin.token}})).status,403);
  for (const route of ['/.env','/server/app.js']) assert.equal((await fetch(base+route)).status,404);
  const initialContent=await request('/api/content','anonymous'); assert.equal(initialContent.customized.length,0);
  assert.equal(initialContent.settings['asset.hero'].en,'/assets/hero-margherita-v2.png');
  const {io}=require('socket.io-client');
  ownerSocket=io(base,{extraHeaders:{Cookie:'bella_session='+actors.owner.token},reconnection:false});
  await new Promise((resolve,reject)=>{ownerSocket.once('connect',resolve);ownerSocket.once('connect_error',reject);setTimeout(()=>reject(Error('Socket timeout')),7000).unref();});
  const baseProduct=(await request('/api/menu','customer')).products.find(product=>product.slug==='margherita'); assert.ok(baseProduct);
  const fee=Number(process.env.DELIVERY_FEE_EGP || 35);
  const address={label:'Test',address_line:'Test street, building 1',phone:'01031252519',latitude:30.228,longitude:31.48};
  const place=async (name,quantity=1)=> (await request('/api/orders','customer','POST',{customerName:name,address,notes:'=SUM(1,1) <unsafe>',items:[{productId:baseProduct.id,quantity,optionIds:[],custom:false}]},201)).order;
  const incoming=new Promise(resolve=>ownerSocket.once('order',resolve));
  const orderA=await place('Delivered fixture'); assert.equal((await incoming).id,orderA.id);
  await request('/api/owner/orders/'+orderA.id+'/status','owner','PATCH',{status:'READY'},409);
  await request('/api/owner/orders/'+orderA.id+'/status','owner','PATCH',{status:'ACCEPTED',actorId:actors.admin.id},400);
  for (const status of ['ACCEPTED','PREPARING','READY']) await request('/api/owner/orders/'+orderA.id+'/status','owner','PATCH',{status});
  await request('/api/owner/orders/'+orderA.id+'/status','owner','PATCH',{status:'DELIVERED'},400);
  await request('/api/owner/orders/'+orderA.id+'/assign','owner','PATCH',{driverId:actors.inactiveDriver.id},404);
  await request('/api/owner/orders/'+orderA.id+'/assign','owner','PATCH',{driverId:actors.driver.id});
  await request('/api/delivery/orders/'+orderA.id+'/pickup','otherDriver','PATCH',undefined,403);
  await request('/api/delivery/orders/'+orderA.id+'/pickup','driver','PATCH');
  await request('/api/owner/orders/'+orderA.id+'/assign','owner','PATCH',{driverId:actors.otherDriver.id},409);
  const code=await request('/api/orders/'+orderA.id+'/code','customer','POST');
  await request('/api/delivery/confirm','driver','POST',{orderId:orderA.id,secret:code.code,latitude:30.228,longitude:31.48});
  const orderB=await place('Cancelled fixture'); await request('/api/owner/orders/'+orderB.id+'/status','owner','PATCH',{status:'CANCELLED'});
  const orderC=await place('=SUM(1,1)',2);
  await db('orders').where({id:orderA.id}).update({created_at:new Date('2026-01-15T22:30:00Z')});
  await db('orders').where({id:orderB.id}).update({created_at:new Date('2026-01-15T10:00:00Z')});
  await db('orders').where({id:orderC.id}).update({created_at:new Date('2026-01-16T08:00:00Z')});
  const period='from=2026-01-16&to=2026-01-16';
  const listed=await request('/api/owner/orders?'+period+'&limit=1','owner'); assert.equal(listed.total,2);assert.equal(listed.orders.length,1);
  const second=await request('/api/owner/orders?'+period+'&limit=1&page=2','owner');assert.notEqual(second.orders[0].id,listed.orders[0].id);
  const analytics=await request('/api/owner/analytics?'+period,'owner');
  assert.equal(analytics.summary.orders,2);assert.equal(analytics.summary.revenue,baseProduct.price_egp+fee);assert.equal(analytics.summary.cancelled,0);assert.equal(analytics.summary.active,1);assert.equal(analytics.topProducts[0].quantity,1);
  await request('/api/owner/analytics?from=2026-02-30&to=2026-03-01','owner','GET',undefined,400);
  await request('/api/owner/orders?from=2026-02-01&to=2026-01-01','owner','GET',undefined,400);
  await request('/api/owner/orders?limit=101','owner','GET',undefined,400);
  await request('/api/owner/orders?role=admin','owner','GET',undefined,400);
  assert.equal((await request('/api/owner/orders?search=%25','owner')).total,0);
  assert.equal((await request('/api/owner/orders?search='+encodeURIComponent("'; DROP TABLE orders; --"),'owner')).total,0);
  const response=await fetch(base+'/api/owner/export?'+period+'&page=1&limit=1',{headers:{Cookie:'bella_session='+actors.owner.token}});
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/);
  const workbook=Buffer.from(await response.arrayBuffer()),files=unzip(workbook),sheet=files['xl/worksheets/sheet2.xml'];
  assert.ok(sheet.includes(orderA.order_number));assert.ok(sheet.includes(orderC.order_number));assert.ok(!sheet.includes(orderB.order_number));
  assert.equal((sheet.match(/<row /g)||[]).length,3);assert.match(sheet,/frozen/);assert.match(sheet,/autoFilter/);assert.ok(!sheet.includes('<f>'));assert.match(sheet,/&lt;unsafe&gt;/);
  await fs.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});await fs.writeFile(path.resolve(__dirname,'../artifacts/owner-orders-test.xlsx'),workbook);
  assert.equal((await request('/api/admin/report?'+period)).summary.orders,2);
  await request('/api/orders/'+orderA.id,'other','GET',undefined,404);
  const savedAddress=await request('/api/addresses','customer','POST',address,201);
  await request('/api/addresses/'+savedAddress.address.id,'other','PUT',address,404);
  const granted=await request('/api/admin/users/'+actors.other.id,'admin','PATCH',{roles:['customer','owner'],is_active:true});assert.ok(granted.user.roles.includes('owner'));
  await request('/api/owner/orders','other');await request('/api/admin/content','other','GET',undefined,403);
  await request('/api/admin/users/'+actors.other.id,'admin','PATCH',{roles:['customer'],is_active:true});
  const productInput=Object.fromEntries(['category_id','name','name_ar','slug','description','description_ar','price_egp','image_url','ingredients','is_available','is_featured','prep_minutes'].map(key=>[key,baseProduct[key]]).filter(([,value])=>value !== undefined));
  await request('/api/admin/products/'+baseProduct.id,'admin','PUT',{...productInput,sale_price_egp:250});
  const discounted=await place('Offer regression',2);assert.equal(discounted.total_egp,500+fee);
  await request('/api/admin/products/'+baseProduct.id,'admin','PUT',{...productInput,sale_price_egp:null});
  const sauce=baseProduct.options.find(option=>option.option_group==='sauce');assert.ok(sauce);
  const built=await request('/api/orders','customer','POST',{customerName:'Builder regression',address,items:[{productId:baseProduct.id,quantity:1,optionIds:[sauce.id],custom:true}]},201);assert.equal(built.order.total_egp,baseProduct.price_egp+sauce.price_delta_egp+fee);
  await save([{key:'JWT_SECRET',en:'bad',ar:'bad'}],400);
  await save([shared('hero.order_link','javascript:alert(1)')],400);
  await save([shared('asset.hero','/assets/../server/app.js')],400);
  await save([shared('business.delivery_fee','-1')],400);
  await save([shared('business.delivery_fee','10.5')],400);
  await save([shared('asset.hero','/uploads/not-found.png')],400);
  const upload=await fetch(base+'/api/admin/uploads',{method:'POST',headers:{Cookie:'bella_session='+actors.admin.token,'Content-Type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64')});
  assert.equal(upload.status,201);const image=(await upload.json()).image_url;uploaded.push(image);
  await save([{key:'hero.title',en:'Fresh from our oven',ar:'طازجة من الفرن'},{key:'footer.copyright',en:'Fixture footer',ar:'فوتر الاختبار'},shared('asset.logo',image)]);
  assert.equal((await request('/manifest.json','anonymous')).icons[0].src,image);
  const custom={slug:'about-test',title_en:'About our pizza',title_ar:'عن البيتزا',body_en:'A fixture page.\n\n<script>window.__contentXss=1</script>',body_ar:'صفحة اختبار.',image:'',published:false};
  await save([shared('pages',JSON.stringify([custom]))]);
  assert.equal(JSON.parse((await request('/api/content','anonymous')).settings.pages.en).length,0);
  assert.equal((await fetch(base+'/pages/about-test')).status,404);
  custom.published=true;await save([shared('pages',JSON.stringify([custom])),shared('header.extra_links',JSON.stringify([{label_en:'About our pizza',label_ar:'عن البيتزا',href:'/pages/about-test',visible:true}]))]);
  await save([shared('pages',JSON.stringify([custom,custom]))],400);
  await request('/api/admin/content/copy','admin','PUT',{entries:[{source:'Made fresh, just for you.',en:'<img src=x onerror="window.__contentXss=1">',ar:'من الفرن مباشرة.'}]});
  await request('/api/admin/content/copy','admin','PUT',{entries:[{source:'a'.repeat(401),en:'x',ar:'x'}]},400);
  await save([shared('business.delivery_fee','99'),shared('business.accept_orders','false')]);
  const config=await request('/api/config','customer');assert.equal(config.deliveryFee,99);assert.equal(config.acceptOrders,false);
  const before=Number((await db('orders').count('* as count').first()).count);
  await request('/api/orders','customer','POST',{customerName:'Paused',address,items:[{productId:baseProduct.id,quantity:1,optionIds:[],custom:false}]},409);
  assert.equal(Number((await db('orders').count('* as count').first()).count),before);
  await save([shared('business.accept_orders','true')]);const newFeeOrder=await place('New delivery fee');assert.equal(newFeeOrder.total_egp,baseProduct.price_egp+99);
  await save([shared('business.delivery_fee',fee)]);
  await assert.rejects(()=>require('../server/db/migrations/202610240006_owner_role').down(db),/Reassign owner accounts/);
  console.log('PASS SQL/API: existing tables, owner isolation, transactions, status/QR workflow, realtime, Cairo dates, pagination, analytics, XLSX rows and formulas, content validation/drafts, safe uploads, operational settings.');

  const {chromium}=require('playwright');browser=await chromium.launch({channel:'chrome',headless:true});
  const pageErrors=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('bella_theme','light');localStorage.setItem('bella_app_installed','1');});
  await context.addCookies([{name:'bella_session',value:actors.admin.token,url:base}]);
  const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
  for(const route of ['/builder','/cart','/orders','/addresses','/login']) { await page.goto(base+route);await page.waitForSelector('#app h1');assert.equal(await page.locator('#app>.page>.error').count(),0,route); }
  await page.goto(base+'/admin?tab=content');await page.waitForSelector('[data-content-form]');
  const hero=page.locator('.content-group').filter({has:page.locator('summary',{hasText:/^Hero$/})});await hero.locator('summary').click();
  await hero.locator('[data-key="hero.title"] [name="en"]').fill('Saved from the admin screen');await hero.locator('[type="submit"]').click();await hero.locator('[data-save-state]').filter({hasText:'Section saved.'}).waitFor();
  await page.goto(base+'/');await page.waitForSelector('.hero h1');assert.match(await page.locator('.hero h1').innerText(),/Saved from the admin screen/);
  assert.equal(await page.locator('.footer-meta>span').innerText(),'Fixture footer');
  assert.ok((await page.locator('.navbar-brand img').getAttribute('src')).includes(image));
  await page.goto(base+'/menu');await page.waitForSelector('h1');assert.ok((await page.locator('.sub').innerText()).includes('<img'));assert.equal(await page.evaluate(()=>window.__contentXss),undefined);
  await page.goto(base+'/pages/about-test');await page.waitForSelector('.content-page-body');assert.equal(await page.locator('.content-page-body script').count(),0);assert.equal(await page.evaluate(()=>window.__contentXss),undefined);
  await page.goto(base+'/menu');await page.waitForSelector('[data-add]');await page.locator('[data-add]').first().click();
  await page.goto(base+'/cart');await page.waitForSelector('[data-qty]');
  await page.goto(base+'/checkout');await page.waitForSelector('#checkout-form');await page.locator('#customerName').fill('Checkout regression');await page.locator('#address_line').fill('Test street, building 2');await page.locator('#phone').fill('01031252519');await page.locator('#place-order').click();await page.waitForURL('**/track?id=*');await page.waitForSelector('#cancel-order');
  await page.goto(base+'/admin');await page.waitForSelector('.workspace-stat');await page.screenshot({path:path.resolve(__dirname,'../artifacts/admin-content-overview.png'),fullPage:true});
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await page.goto(base+'/admin?tab=content');await page.waitForSelector('[data-content-form]');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Content editor overflow');
  }
  await context.close();
  const ownerContext=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await ownerContext.addInitScript(()=>{localStorage.setItem('bella_theme','light');localStorage.setItem('bella_app_installed','1');});
  await ownerContext.addCookies([{name:'bella_session',value:actors.owner.token,url:base}]);
  const ownerPage=await ownerContext.newPage();ownerPage.on('pageerror',error=>pageErrors.push(error.message));
  await ownerPage.goto(base+'/owner?tab=analytics&'+period);await ownerPage.waitForSelector('.owner-metrics');
  assert.equal(await ownerPage.locator('[data-tab="content"]').count(),0);assert.equal(await ownerPage.locator('[data-tab="staff"]').count(),0);
  const downloadPromise=ownerPage.waitForEvent('download');await ownerPage.locator('#owner-export').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.xlsx$/);await download.saveAs(path.resolve(__dirname,'../artifacts/owner-browser-export.xlsx'));
  await ownerPage.screenshot({path:path.resolve(__dirname,'../artifacts/owner-analytics-desktop.png'),fullPage:true});
  for (const tab of ['orders','delivery','kitchen','analytics']) {
    await ownerPage.setViewportSize({width:390,height:844});await ownerPage.goto(base+'/owner?tab='+tab+'&'+period);await ownerPage.waitForSelector('#owner-results:not([aria-busy="true"])');await ownerPage.waitForSelector('#loading-screen',{state:'hidden'});
    assert.equal(await ownerPage.locator('#owner-results>.error').count(),0,tab+' errors');assert.equal(await ownerPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,tab+' overflow');
  }
  await ownerPage.screenshot({path:path.resolve(__dirname,'../artifacts/owner-analytics-mobile.png'),fullPage:true});
  await ownerPage.evaluate(()=>localStorage.setItem('bella_language','ar'));await ownerPage.reload();await ownerPage.waitForSelector('.owner-metrics');await ownerPage.waitForSelector('#loading-screen',{state:'hidden'});assert.equal(await ownerPage.evaluate(()=>document.documentElement.dir),'rtl');assert.equal(await ownerPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(pageErrors,[]);await ownerContext.close();
  console.log('PASS browser: admin saves persist to storefront, safe page/text rendering, owner dashboard separation, real Excel download, all owner tabs and content editor at desktop/mobile widths.');
}
run().catch(error=>{console.error(error.stack || error.message);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();ownerSocket?.disconnect();
  if(ioServer)await new Promise(resolve=>ioServer.close(resolve));
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  if(db)await db.destroy();
  for(const url of uploaded) {
    assert.match(url,/^\/uploads\/[a-f0-9-]+\.png$/i);const file=path.resolve(__dirname,'../public',url.slice(1));assert.ok(file.startsWith(path.resolve(__dirname,'../public/uploads')+path.sep));await fs.unlink(file).catch(()=>{});
  }
  if(createdDatabase) {assert.match(testName,/^bella_feature_test_[a-f0-9]{16}$/);assert.notEqual(testName,originalName);await master.raw('ALTER DATABASE ?? SET SINGLE_USER WITH ROLLBACK IMMEDIATE',[testName]);await master.raw('DROP DATABASE ??',[testName]);console.log('Isolated test database removed; live database unchanged.');}
  await master.destroy();
});
