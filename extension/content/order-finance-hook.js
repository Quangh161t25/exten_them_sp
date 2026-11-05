// Chỉ giữ cặp mã đơn / ID từ phản hồi danh sách. Không giữ cookie hoặc thông tin khách.
(() => {
  const ids=new Map(),REQUEST='QLSP_FINANCE_IDS_REQUEST',REPLY='QLSP_FINANCE_IDS';
  function publish(){window.postMessage({channel:REPLY,ids:[...ids].map(([sn,id])=>({sn,id}))},location.origin);}
  function receive(data){
    if(data?.code||data?.error)return;
    const queue=[data?.data||data];let count=0;
    while(queue.length&&count++<30000){
      const o=queue.shift();if(!o||typeof o!=='object')continue;
      const id=o.order_ext_info?.order_id||o.order_id;
      const sn=o.card_header?.order_sn||o.order_sn;
      if(id&&/^[A-Z0-9]{10,30}$/.test(String(sn)))ids.set(String(sn),String(id));
      for(const value of Object.values(o))if(value&&typeof value==='object')queue.push(value);
    }
    while(ids.size>1000)ids.delete(ids.keys().next().value);
    publish();
  }
  const relevant=url=>String(url).includes('/api/v3/order/get_order_list_card_list');
  const original=window.fetch;
  window.fetch=async function(input,...rest){
    const response=await original.call(this,input,...rest);
    if(relevant(typeof input==='string'?input:input?.url))response.clone().json().then(receive).catch(()=>{});
    return response;
  };
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
  const urls=new WeakMap();
  XMLHttpRequest.prototype.open=function(method,url,...rest){urls.set(this,url);return open.call(this,method,url,...rest);};
  XMLHttpRequest.prototype.send=function(...args){
    if(relevant(urls.get(this)))this.addEventListener('load',()=>{try{receive(this.responseType==='json'?this.response:JSON.parse(this.responseText));}catch{}},{once:true});
    return send.apply(this,args);
  };
  window.addEventListener('message',e=>{if(e.source===window&&e.origin===location.origin&&e.data?.channel===REQUEST)publish();});
})();
