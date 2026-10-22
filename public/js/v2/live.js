// Database polling provides cross-instance updates without an in-memory room dependency.
export function createLiveClient(config,api) {
  if(config.realtimeMode!=='poll')return window.io?.();
  const handlers=new Map();let timer,stopped=false,running=false,connected=false,version,placed,locationId,watch,failures=0;
  const dispatch=(event,payload)=>{for(const fn of handlers.get(event)||[])Promise.resolve().then(()=>fn(payload)).catch(()=>{});};
  const client={
    on(event,fn){if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);return client;},
    off(event,fn){handlers.get(event)?.delete(fn);return client;},
    emit(event,id,ack){if(event==='watch'&&watch!==id){watch=id;locationId=undefined;clearTimeout(timer);poll();}ack?.({ok:true});return client;},
    disconnect(){stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);}
  };
  async function poll(){
    if(stopped||running)return;
    if(document.hidden){timer=setTimeout(poll,6000);return;}
    running=true;
    try{
      const result=await api('/api/live'+(watch?'?watch='+encodeURIComponent(watch):''));failures=0;
      if(!connected){connected=true;dispatch('connect');}
      else if(version!==result.version)dispatch('order',{id:result.tracked?.id||null,status:placed!==result.latestPlacedId&&result.latestPlacedId?'PLACED':result.tracked?.status||'CHANGED'});
      if(result.location&&result.location.id!==locationId){locationId=result.location.id;dispatch('location',{orderId:result.location.order_id,latitude:Number(result.location.latitude),longitude:Number(result.location.longitude)});}
      version=result.version;placed=result.latestPlacedId;
    }catch(error){failures++;if(error.status===401)stopped=true;}
    finally{running=false;if(!stopped){clearTimeout(timer);timer=setTimeout(poll,Math.min(30000,6000*Math.max(1,failures)));}}
  }
  function visible(){if(!document.hidden){clearTimeout(timer);poll();}}
  document.addEventListener('visibilitychange',visible);timer=setTimeout(poll,0);return client;
}
