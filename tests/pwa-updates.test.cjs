const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');
const {stamp}=require('../scripts/pwa-release.cjs');
test('Build releases are stable and change for updated application or worker code',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bella-pwa-'));
 try{fs.writeFileSync(path.join(dir,'sw.js'),"const VERSION = 'bella-dev';\n");fs.writeFileSync(path.join(dir,'app.js'),'v1');
 const first=stamp(dir);assert.equal(stamp(dir),first);
 fs.writeFileSync(path.join(dir,'app.js'),'v2');const second=stamp(dir);assert.notEqual(second,first);assert.equal(stamp(dir),second);
 fs.appendFileSync(path.join(dir,'sw.js'),'// changed worker');assert.notEqual(stamp(dir),second);
 }finally{const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));fs.rmSync(resolved,{recursive:true,force:true});}
});
function fixture({controlled=true,pathname='/',hidden=false}={}){
 const events={},swEvents={},windowEvents={},timers=[];let checks=0,reloads=0,registered;
 let now=100000;const reg={update:async()=>{checks++;}};
 const target={serviceWorker:{controller:controlled?{}:null,addEventListener:(e,fn)=>swEvents[e]=fn,register:async(...args)=>{registered=args;return reg;}},onLine:true};
 const document={hidden,querySelector:()=>null,addEventListener:(e,fn)=>events[e]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/js/pwa-updates.js'),'utf8'),{navigator:target,document,window:{addEventListener:(e,fn)=>windowEvents[e]=fn},location:{pathname,reload:()=>reloads++},setInterval:(fn,ms)=>timers.push({fn,ms}),Date:{now:()=>now}});
 return {events,swEvents,windowEvents,timers,target,document,tick:()=>now+=60000,get checks(){return checks;},get reloads(){return reloads;},get registered(){return registered;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Updates bypass HTTP cache, check periodically and reload exactly once',async()=>{
 const f=fixture();await flush();assert.equal(f.registered[0],'/sw.js');assert.equal(f.registered[1].updateViaCache,'none');assert.equal(f.checks,1);
 f.tick();await f.timers[0].fn();assert.equal(f.checks,2);assert.equal(f.timers[0].ms,60000);
 f.swEvents.controllerchange();f.swEvents.controllerchange();assert.equal(f.reloads,1);
});
test('First installation does not reload, and checkout or unsaved forms are retained',async()=>{
 const fresh=fixture({controlled:false});await flush();fresh.swEvents.controllerchange();assert.equal(fresh.reloads,0);
 const checkout=fixture({pathname:'/checkout'});await flush();checkout.swEvents.controllerchange();assert.equal(checkout.reloads,0);
 const dirty=fixture();await flush();dirty.events.input({target:{closest:()=>({})}});dirty.swEvents.controllerchange();assert.equal(dirty.reloads,0);
});
test('Hidden and offline clients apply pending updates on return without reload loops',async()=>{
 const f=fixture({hidden:true});await flush();assert.equal(f.checks,0);f.swEvents.controllerchange();assert.equal(f.reloads,0);
 f.document.hidden=false;f.target.onLine=false;await f.events.visibilitychange();assert.equal(f.reloads,0);
 f.target.onLine=true;await f.windowEvents.online();assert.equal(f.reloads,1);
});
