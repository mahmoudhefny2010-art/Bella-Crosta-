const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {createPayment}=require('../server/services/payments');
test('Cashier payment is available for pickup orders',async()=>{assert.deepEqual(await createPayment({payment_method:'PAY_AT_CASHIER',total_egp:300}),{method:'PAY_AT_CASHIER',amount:300,currency:'EGP',status:'DUE_AT_CASHIER'});});
test('PWA installs its offline shell when push CDN is unavailable',async()=>{
 const handlers={};let assets=[];let claimed=false;
 const sandbox={importScripts(){throw new Error('Offline');},console:{warn(){}},URL,
  self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}},
  caches:{open:async()=>({addAll:async list=>{assets=list;}}),keys:async()=>[],delete:async()=>true,match:async()=>({offline:true})},fetch:async()=>{throw new Error('Offline');}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'),sandbox);
 let work;handlers.install({waitUntil:p=>work=p});await work;
 assert.ok(assets.includes('/offline.html'));for(const asset of assets)assert.ok(fs.existsSync(path.join(__dirname,'../public',asset)),asset);
 handlers.activate({waitUntil:p=>work=p});await work;assert.equal(claimed,true);
 handlers.fetch({request:{url:'https://example.test/checkout',method:'GET',mode:'navigate'},respondWith:p=>work=p});assert.deepEqual(await work,{offline:true});
 let intercepted=false;handlers.fetch({request:{url:'https://example.test/api/orders',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('Order push routes customer tracking and ready-driver alerts and tolerates provider failure',async()=>{
 const calls=[];const sandbox={module:{exports:{}},process:{env:{ONESIGNAL_APP_ID:'test-app',ONESIGNAL_REST_API_KEY:'test-key',APP_URL:'https://example.test/'}},AbortSignal,console:{error(){}},fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/services/notifications.js'),'utf8'),sandbox);
 await sandbox.module.exports({id:'order',user_id:'customer',assigned_driver_id:'driver',status:'READY',order_number:'BC-TEST',fulfillment_type:'DELIVERY'});
 assert.equal(calls.length,2);assert.ok(calls.some(c=>c.include_aliases.external_id.includes('customer')&&c.url.endsWith('/track?id=order')));assert.ok(calls.some(c=>c.include_aliases.external_id.includes('driver')&&c.url==='https://example.test/delivery'));
 calls.length=0;await sandbox.module.exports({id:'order',user_id:'customer',assigned_driver_id:'driver',status:'READY',order_number:'BC-TEST',fulfillment_type:'PICKUP'});assert.equal(calls.length,1);
 sandbox.fetch=async()=>{throw new Error('Network unavailable');};await assert.doesNotReject(()=>sandbox.module.exports({id:'order',user_id:'customer',status:'ACCEPTED',order_number:'BC-TEST'}));
});
