const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const {chromium}=require('playwright');
(async()=>{
 const app=express();
 app.use(express.static(path.resolve(__dirname,'../public')));
 app.get('/',(_req,res)=>res.sendFile(path.resolve(__dirname,'../public/pages/app.html')));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const [width,height] of [[320,480],[390,844],[844,390]])for(const language of ['en','ar']){
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage();let logoutRequests=0;const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(language=>{localStorage.setItem('bella_language',language);localStorage.setItem('bella_first_visit_onboarding_v2','1');},language);
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.abort();
    if(url.pathname==='/vendor/socket.io.min.js')return route.fulfill({contentType:'application/javascript',body:''});
    if(url.pathname==='/api/menu')return route.fulfill({json:{products:[],categories:[]}});
    if(url.pathname==='/api/me')return route.fulfill({json:{user:{id:'test-user',name:'Mobile test',email:'mobile@example.invalid',roles:['customer','admin','owner','kitchen','driver']}}});
    if(url.pathname==='/api/config')return route.fulfill({json:{deliveryFee:35,acceptOrders:true}});
    if(url.pathname==='/api/orders/reorder')return route.fulfill({json:{items:[]}});
    if(url.pathname==='/auth/logout'){logoutRequests++;return route.fulfill({json:{ok:true}});}
    if(url.pathname.startsWith('/api/'))return route.fulfill({status:404,json:{message:'Not found'}});
    return route.continue();
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   await page.waitForSelector('.home-intro');
   await page.locator('#mobile-nav').tap();await page.locator('#account-toggle').tap();
   const popover=page.locator('#account-popover');await popover.waitFor({state:'visible'});
   assert.equal(await popover.evaluate(el=>el.parentElement===document.body),true);
   const bounds=await popover.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height,JSON.stringify(bounds));
   for(const href of ['/orders','/admin','/owner','/kitchen','/delivery']){
    const link=popover.locator(`a[href="${href}"]`);await link.scrollIntoViewIfNeeded();
    assert.equal(await link.evaluate(el=>{const r=el.getBoundingClientRect();const p=el.closest('#account-popover').getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=p.top&&r.bottom<=p.bottom&&!!hit&&el.contains(hit);}),true,href);
   }
   const logout=page.locator('#logout');await logout.scrollIntoViewIfNeeded();
   // Simulate a browser compatibility click after a finger moved on the sign-out row.
   await logout.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+10,y=r.y+10;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'touch',clientX:x,clientY:y}));el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'touch',clientX:x,clientY:y-60}));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'touch',clientX:x,clientY:y-60}));el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));});
   assert.equal(logoutRequests,0,'Scroll must never sign out');
   const cdp=await context.newCDPSession(page);
   const point={x:Math.round(bounds.x+bounds.width/2),y:Math.round(bounds.y+Math.min(bounds.height-30,150))};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y+110}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(await page.locator('#pull-to-refresh').isVisible(),false,'Account scroll must not trigger page refresh');
   assert.equal(logoutRequests,0);assert.equal(await popover.isVisible(),true);
   await page.locator('#logout').scrollIntoViewIfNeeded();
   fs.mkdirSync(path.resolve(__dirname,'../artifacts'),{recursive:true});
   await page.screenshot({path:path.resolve(__dirname,`../artifacts/account-mobile-${width}-${height}-${language}.png`)});
   if(width===390&&language==='en'){
    await page.setViewportSize({width:1280,height:900});assert.equal(await popover.evaluate(el=>el.parentElement.id),'account-menu');
    await page.setViewportSize({width,height});assert.equal(await popover.evaluate(el=>el.parentElement===document.body),true);
   }
   await Promise.all([page.waitForRequest(r=>r.url().endsWith('/auth/logout')),page.locator('#logout').tap()]);
   assert.equal(logoutRequests,1,'A deliberate sign-out tap must work');
   assert.deepEqual(errors,[]);console.log(`Account menu ${width}x${height} ${language}: links reachable, swipe safe, explicit sign-out PASS`);
   await context.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
