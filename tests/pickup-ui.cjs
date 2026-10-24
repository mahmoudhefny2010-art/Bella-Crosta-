const assert=require('node:assert/strict');
const path=require('node:path');
const express=require('express');
const {chromium}=require('playwright');
(async()=>{
 const app=express();app.use(express.static(path.resolve(__dirname,'../public')));
 app.get('/fixture',(_req,res)=>res.send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/bella.css"><link rel="stylesheet" href="/css/pages/checkout.css"><main id="app"></main>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const width of [320,390,768,1440])for(const language of ['en','ar']){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
   await page.evaluate(async language=>{
    document.documentElement.dir=language==='ar'?'rtl':'ltr';
    const checkout=(await import('/js/v2/pages/checkout.js')).default;
    const $=s=>document.querySelector(s);const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    window.submitted=null;
    const ctx={language,app:$('#app'),$: $,esc:escape,tr:s=>s,t:s=>s,user:{name:'Test',email:'test@example.invalid'},config:{deliveryFee:35},cart:[{productId:'pizza',optionIds:[],quantity:1}],
     api:async(url,options)=>{if(url==='/api/addresses')return {addresses:[]};window.submitted=options.body;throw new Error('Captured order');},
     page:()=>{ $('#app').innerHTML='<section class="page"><div id="view"></div></section>';return $('#view');},
     field:(name,title,value='',type='text',required=true)=>`<label for="${name}">${title}</label><input id="${name}" name="${name}" value="${escape(value)}" type="${type}" ${required?'required':''}>`,
     productFor:()=>({name:'Pizza',options:[]}),local:(p,k)=>p[k],money:n=>'EGP '+n,total:()=>300,unit:()=>300,
     requireUser:()=>true,mountMap:async()=>{throw new Error('Map unavailable');},bind:(s,e,fn)=>$(s)?.addEventListener(e,fn),busy:async(b,fn)=>{b.disabled=true;try{return await fn();}finally{b.disabled=false;}},addressInput:()=>{throw new Error('Pickup attempted address validation');},saveCart:()=>{},toast:()=>{}};
    await checkout(ctx);
   },language);
   await page.locator('[value=PICKUP]').check();
   assert.equal(await page.locator('#checkout-address-section').isVisible(),false);
   assert.equal(await page.locator('[value=PAY_AT_CASHIER]').isChecked(),true);
   assert.equal(await page.locator('#summary-total').innerText(),'EGP 300');
   assert.equal(await page.locator('#checkout-form').evaluate(f=>f.checkValidity()),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`Overflow ${width} ${language}`);
   await page.locator('#place-order').click();await page.waitForFunction(()=>window.submitted);
   const payload=await page.evaluate(()=>window.submitted);
   assert.equal(payload.paymentMethod,'PAY_AT_CASHIER');assert.equal(payload.fulfillmentType,'PICKUP');assert.equal('address' in payload,false);assert.equal('addressId' in payload,false);
   await page.locator('[value=DELIVERY]').check();
   assert.equal(await page.locator('#checkout-address-section').isVisible(),true);
   assert.equal(await page.locator('[value=CASH_ON_DELIVERY]').isChecked(),true);
   assert.equal(await page.locator('#summary-total').innerText(),'EGP 335');
   assert.equal(await page.locator('#address_line').isEnabled(),true);
   console.log(`Pickup checkout and delivery switch: ${width}px ${language} PASS`);await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
