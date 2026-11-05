import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
globalThis.chrome={runtime:{onMessage:{addListener(){}}}};
const {costMap,financials,readOrderFinancialApi}=await import('../extension/order-tool/list-finance.js');
const {parseIncome}=await import('../extension/order-tool/orders.js');
const prices=costMap([['id_sp_con','gia_ban'],['N048-BK-00','500.000'],['FREE-BK-00',0]]);
assert.equal(costMap([['id_sp_con','gia_ban'],['SKU','500,000']]).get('SKU'),500000);
const order={items:[{name:'Nồi',modelSku:'N048-BK-00-JOY-00-001-Nồi',qty:1}]};
const income=parseIncome({seller_income_breakdown:{breakdown:[{field_name:'MERCHANDISE_SUBTOTAL',amount:99900000000},{field_name:'ESCROW_AMOUNT',amount:76118500000}]}});
assert.deepEqual([financials(order,income,prices).merchandise,financials(order,income,prices).revenue,financials(order,income,prices).capital,financials(order,income,prices).profit],[999000,761185,500000,261185]);
assert.equal(financials({items:[...order.items,{modelSku:'MISSING',qty:2}]},income,prices).profit,null);
assert.equal(financials({items:[]},income,prices).capital,null);
assert.equal(financials(order,null,prices).profit,null);
assert.equal(financials({items:[{modelSku:'FREE-BK-00',qty:2}]},{byField:{ESCROW_AMOUNT:0}},prices).profit,0);
assert.equal(financials({items:[{modelSku:'N048-BK-00-JOY',qty:2}]},{byField:{ESCROW_AMOUNT:100000}},prices).profit,-900000);
const ambiguous=costMap([['id_sp_con','gia_ban'],['N048-BK-00-A',10],['N048-BK-00-B',20]]);
assert.equal(financials(order,income,ambiguous).capital,null);
assert.equal(financials({items:[{modelSku:'N048-BK-00-A',qty:1}]},income,ambiguous).capital,10);
const hidden=parseIncome({seller_income_breakdown:{breakdown:[{field_name:'ESCROW_AMOUNT',amount:0,hide_amount:true}]}});
assert.equal(financials(order,hidden,prices).profit,null);
console.log('PASS: số liệu mẫu 999.000 / 761.185, vốn theo SKU × SL, thiếu vốn không báo lãi giả, vốn 0, lỗ và giá vốn trùng mơ hồ.');

const calls=[];let shopCalls=0,switchShop=false;
globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  assert.ok(!/shipment|batch_init|send_message/.test(url));
  let data;
  if(url.includes('shop_info')){shopCalls++;data={shop_id:switchShop&&shopCalls%2===0?8:7};}
  else if(url.includes('get_one_order'))data={order_id:'247319248296217'};
  else if(url.includes('income_components'))data={seller_income_breakdown:{breakdown:[{field_name:'ESCROW_AMOUNT',amount:76118500000}]}};
  else throw Error('Unexpected API');
  return {ok:true,json:async()=>({data})};
};
const read=await readOrderFinancialApi('247319248296217','fake-csrf',null);
assert.equal(read.shopId,'7');assert.equal(read.incomeError,'');
assert.equal(JSON.parse(calls.find(c=>c.url.includes('income_components')).options.body).order_id,247319248296217);
assert.ok(calls.every(c=>c.options.credentials==='include'&&c.options.signal));
switchShop=true;await assert.rejects(()=>readOrderFinancialApi('247319248296217','fake',null),/Shop đã đổi/);
console.log('PASS: API chỉ đọc, gửi cookie cùng phiên, đúng ID, kiểm tra shop trước/sau.');

let listener,actualTarget;
const ctx={console,Map,Promise,Date,
  getGoogleAccessToken:async()=>'fake',getSpreadsheetId:async()=>'fake',fetchSheetValues:async()=>[['id_sp_con','gia_ban'],['N048-BK-00',500000]],
  chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}},cookies:{get:async()=>({value:'fake'})},scripting:{executeScript:async request=>{
    actualTarget=request.target;
    return [{result:{shopId:'7',variant:0,detail:{order_id:'247319248296217',order_sn:'2610299AAVT8S',items:[{item_id:10,model_id:20,product_name:'Nồi',model_sku:'N048-BK-00-JOY',amount:1}]},income:{seller_income_breakdown:{breakdown:[{field_name:'ESCROW_AMOUNT',amount:76118500000},{field_name:'MERCHANDISE_SUBTOTAL',amount:99900000000}]}}}}];
  }}}};
vm.createContext(ctx);vm.runInContext(await fs.readFile(new URL('../extension/order-tool/list-finance.bundle.js',import.meta.url),'utf8'),ctx);
const send=(msg,sender)=>new Promise(resolve=>listener(msg,sender,resolve));
const response=await send({type:'QLSP_ORDER_LIST_FINANCE',orderId:'247319248296217',orderSn:'2610299AAVT8S'},{tab:{id:123},frameId:0,documentId:'doc-1',url:'https://banhang.shopee.vn/portal/sale/order'});
assert.equal(response.ok,true);assert.equal(response.capital,500000);assert.equal(response.profit,261185);
assert.equal(actualTarget.tabId,123);assert.equal(actualTarget.documentIds[0],'doc-1');assert.ok(!actualTarget.frameIds);
assert.equal((await send({type:'QLSP_ORDER_LIST_FINANCE',orderId:'247319248296217'},{tab:{id:123},frameId:0,url:'https://example.com/'})).ok,false);
console.log('PASS: worker chạy đúng tab + document gửi yêu cầu, trả số liệu và chặn nguồn ngoài Shopee.');

const events={},messages=[];
class XHR {open(){}send(){}addEventListener(name,fn){this.handler=fn;}}
const hook={location:{origin:'https://banhang.shopee.vn'},XMLHttpRequest:XHR,window:{fetch:async()=>({clone:()=>({json:async()=>({data:{card_list:[{order_card:{order_ext_info:{order_id:247319248296217},card_header:{order_sn:'2610299AAVT8S'}}}]}})})}),postMessage(data){messages.push(data);},addEventListener(name,fn){events[name]=fn;}}};
vm.createContext(hook);vm.runInContext(await fs.readFile(new URL('../extension/content/order-finance-hook.js',import.meta.url),'utf8'),hook);
await hook.window.fetch('/api/v3/order/get_order_list_card_list');await new Promise(r=>setImmediate(r));
assert.equal(messages.at(-1).ids[0].id,'247319248296217');
events.message({source:hook.window,origin:hook.location.origin,data:{channel:'QLSP_FINANCE_IDS_REQUEST'}});
assert.equal(messages.at(-1).ids[0].sn,'2610299AAVT8S');
console.log('PASS: bắt ID từ phản hồi danh sách và phát lại khi content script tải sau API.');

// Fixture DOM tối thiểu: kiểm tra hành vi tải một lần và thao tác khung.
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.className='';this.hidden=false;this.textContent='';this.nodeType=1;}
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
  replaceChildren(){this.children=[];}
  get isConnected(){return this===card||!!this.parent?.isConnected;}
  get classList(){return {contains:c=>this.className.split(' ').includes(c)};}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){return this.children.flatMap(n=>[...(selector==='span.order-sn'?n===snNode:selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):false)?[n]:[],...n.querySelectorAll(selector)]);}
  setAttribute(name,value){this[name]=value;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
}
const timers=[],financeCalls=[],card=new Element(),snNode=new Element('span');
snNode.textContent='2611016J00CVFE';snNode.closest=()=>card;card.append(snNode);
const baseQuery=card.querySelector.bind(card);
card.querySelector=selector=>selector.startsWith('a[')?{getAttribute:()=>'/portal/sale/order/247319248296217'}:baseQuery(selector);
let mutation,storageChange;
const doc={head:new Element('head'),body:card,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='span.order-sn'?[snNode]:card.querySelectorAll(selector)};
const ui={document:doc,location:{origin:'https://banhang.shopee.vn',pathname:'/portal/sale/order'},window:{addEventListener(){},postMessage(){}},
  MutationObserver:class{constructor(callback){mutation=callback;}observe(){}},
  setTimeout:fn=>{timers.push(fn);return timers.length;},
  chrome:{storage:{local:{get:(key,reply)=>reply({[key]:[]})},onChanged:{addListener(fn){storageChange=fn;}}},runtime:{sendMessage:(msg,reply)=>{
    financeCalls.push(msg);reply({ok:true,at:Date.now(),items:[],missing:[],quantity:1,merchandise:999000,revenue:761185,capital:500000,profit:261185});
  }}}
};ui.window.top=ui.window;
vm.createContext(ui);vm.runInContext(await fs.readFile(new URL('../extension/content/order-list-finance.js',import.meta.url),'utf8'),ui);
const drain=()=>{let guard=0;while(timers.length){assert.ok(guard++<20);timers.shift()();}};
const rescan=()=>{mutation([{target:card,addedNodes:[snNode],removedNodes:[]}]);drain();};
drain();assert.equal(financeCalls.length,1);
rescan();rescan();assert.equal(financeCalls.length,1);
let panel=card.querySelector('.qlsp-order-finance');
const event={preventDefault(){},stopPropagation(){}};
panel.querySelector('.qlsp-finance-actions').children[0].onclick(event);
assert.equal(panel.querySelector('.qlsp-finance-body').hidden,true);
storageChange({'tcdd-wml-watch':{newValue:[{order_sn:snNode.textContent,at:Date.now()}]}},'local');
assert.equal(panel.querySelector('.qlsp-finance-wml').hidden,false);assert.equal(financeCalls.length,1);
panel.querySelector('.qlsp-finance-actions').children[1].onclick(event);drain();
assert.equal(financeCalls.length,2);assert.equal(financeCalls[1].force,true);
assert.equal(panel.querySelector('.qlsp-finance-body').hidden,true);
panel.remove();rescan();panel=card.querySelector('.qlsp-order-finance');
assert.equal(financeCalls.length,2);assert.equal(panel.querySelector('.qlsp-finance-body').hidden,true);
storageChange({'tcdd-wml-watch':{newValue:[]}},'local');
assert.equal(panel.querySelector('.qlsp-finance-wml').hidden,true);
console.log('PASS: DOM thay đổi không tải lại, ↻ mới gọi API, thu gọn giữ sau refresh/remount, WML cập nhật không gọi API.');
