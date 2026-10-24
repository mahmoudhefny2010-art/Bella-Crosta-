const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const express=require('express');const {chromium}=require('playwright');
(async()=>{
 const app=express();let release=1,broken=false;const navigations=new Map();
 const source=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');
 app.get('/sw.js',(_req,res)=>res.set('Cache-Control','no-store').type('js').send(source.replace(/^try \{ importScripts[^\n]*\n/,'').replace(/const VERSION = '[^']+';/,`const VERSION = 'bella-browser-${release}';`).replace(/const SHELL = \[[\s\S]*?\n\];/,"const SHELL = ['/offline.html','/js/pwa-updates.js','/test-asset.js'];")));
 app.get('/test-asset.js',(_req,res)=>broken?res.sendStatus(503):res.type('js').send('window.assetVersion='+release));
 app.get('/offline.html',(_req,res)=>res.send('Offline'));
 app.use('/js',express.static(path.join(__dirname,'../public/js')));
 const html=req=>`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/test-asset.js"></script><script defer src="/js/pwa-updates.js"></script><h1>PWA update fixture</h1><form><input id="draft" name="draft"></form><p>${req.path}</p>`;
 for(const route of ['/','/checkout','/draft'])app.get(route,(req,res)=>{navigations.set(route,(navigations.get(route)||0)+1);res.set('Cache-Control','no-store').send(html(req));});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const mobile of [false,true]){
   release=1;broken=false;navigations.clear();
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
   const base='http://127.0.0.1:'+server.address().port;
   const home=await context.newPage();await home.goto(base);await home.waitForFunction(()=>!!navigator.serviceWorker.controller);
   assert.equal(navigations.get('/'),1,'First install must not reload');
   const checkout=await context.newPage();await checkout.goto(base+'/checkout');await checkout.locator('#draft').fill('Unfinished checkout');
   const draft=await context.newPage();await draft.goto(base+'/draft');await draft.locator('#draft').fill('Unsaved address');
   await home.bringToFront();
   release=2;
   await home.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
   await home.waitForFunction(()=>window.assetVersion===2);
   assert.equal(navigations.get('/'),2,'New release must reload once');
   assert.equal(await checkout.locator('#draft').inputValue(),'Unfinished checkout');assert.equal(await checkout.evaluate(()=>window.assetVersion),1);
   assert.equal(await draft.locator('#draft').inputValue(),'Unsaved address');assert.equal(await draft.evaluate(()=>window.assetVersion),1);
   assert.equal(navigations.get('/checkout'),1);assert.equal(navigations.get('/draft'),1);
   // A partial deployment must leave the last complete release in control.
   release=3;broken=true;
   await home.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise(async resolve=>{r.addEventListener('updatefound',()=>{const worker=r.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve();});},{once:true});await r.update();});});
   assert.equal(navigations.get('/'),2);assert.equal(await home.evaluate(()=>window.assetVersion),2);
   assert.equal(await home.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.active.state;}),'activated');
   console.log(`${mobile?'Mobile':'Desktop'} PWA: automatic release reload, checkout/draft retention and failed-install recovery PASS`);
   await context.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
