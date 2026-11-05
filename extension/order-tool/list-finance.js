import {parseOrder,parseIncome,findDeep} from './orders.js';

export function costMap(values) {
  const head=(values[0]||[]).map(v=>String(v).trim().toLowerCase());
  const id=head.findIndex(v=>['id_sp_con','id_sp_ct'].includes(v)),price=head.indexOf('gia_ban');
  if(id<0||price<0)throw new Error('DS_SP thiếu cột id_sp_con/id_sp_ct hoặc gia_ban');
  const result=new Map();
  for(const row of values.slice(1)){
    const key=String(row[id]||'').trim().toUpperCase(),raw=String(row[price]??'').trim();
    if(!key||!raw)continue;
    let amount=raw.replace(/[^\d,.-]/g,'');
    if(/^-?\d{1,3}([.,]\d{3})+$/.test(amount))amount=amount.replace(/[.,]/g,'');
    else if(amount.includes(',')&&amount.includes('.')){
      const decimal=amount.lastIndexOf(',')>amount.lastIndexOf('.')?',':'.';
      amount=amount.replace(decimal===','?/\./g:/,/g,'').replace(',','.');
    }else amount=amount.replace(',','.');
    const value=typeof row[price]==='number'?row[price]:Number(amount);
    if(!Number.isFinite(value)||value<0)continue;
    for(const k of new Set([key,key.slice(0,10)])){
      if(result.has(k)&&result.get(k)!==value)result.set(k,null);else if(!result.has(k))result.set(k,value);
    }
  }
  return result;
}
export function financials(order,income,prices) {
  const items=order.items.map(it=>{
    const sku=String(it.modelSku||'').trim().toUpperCase();
    const exact=prices?.get(sku),unit=exact!==undefined?exact:prices?.get(sku.slice(0,10));
    return {name:it.name,sku:it.modelSku,qty:it.qty,unitCost:unit??null,cost:unit==null?null:unit*it.qty};
  });
  const missing=items.filter(it=>it.cost==null||!(it.qty>0));
  const capital=items.length&&!missing.length?items.reduce((s,it)=>s+it.cost,0):null;
  const revenue=income?.byField.ESCROW_AMOUNT??null;
  return {merchandise:income?.byField.MERCHANDISE_SUBTOTAL??null,revenue,capital,profit:capital==null||revenue==null?null:revenue-capital,
    quantity:items.reduce((s,it)=>s+it.qty,0),missing:missing.map(it=>it.sku||it.name||'SP chưa có SKU'),items};
}

// Chạy trong đúng tab gửi yêu cầu; chỉ gọi các API đọc của Kênh Người Bán.
export async function readOrderFinancialApi(orderId,spc,variant) {
  const query=new URLSearchParams({SPC_CDS:spc,SPC_CDS_VER:'2'});
  async function request(path,body){
    const response=await fetch(path+(path.includes('?')?'&':'?')+query,{method:body?'POST':'GET',credentials:'include',headers:{accept:'application/json','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Shopee HTTP ${response.status}`);
    const json=await response.json();if(json.code||json.error)throw new Error(json.message||json.msg||'Shopee từ chối yêu cầu');return json.data;
  }
  const shop=await request('/api/selleraccount/shop_info/');
  const shopId=String(shop?.shop_id||shop?.shopid||'');if(!shopId)throw new Error('Không xác định được shop đang đăng nhập');
  const detail=await request('/api/v3/order/get_one_order?order_id='+encodeURIComponent(orderId));
  let income=null,error='',used=variant;
  const variants=[[2,3],[1,2,3],[1,2,3,4,5],null];
  const order=[variant,...variants.map((_,i)=>i)].filter((v,i,a)=>Number.isInteger(v)&&a.indexOf(v)===i);
  for(const i of order){
    try{
      const d=await request('/api/v4/accounting/pc/seller_income/income_detail/get_order_income_components',{order_id:Number(orderId),...(variants[i]?{components:variants[i]}:{})});
      if(d?.seller_income_breakdown?.breakdown?.length){income=d;used=i;break;}
      error='Shopee chưa trả thông tin doanh thu';
    }catch(e){error=e.message;}
  }
  const check=await request('/api/selleraccount/shop_info/');
  if(String(check?.shop_id||check?.shopid)!==shopId)throw new Error('Shop đã đổi trong lúc tải, vui lòng thử lại');
  return {detail,income,incomeError:income?'':error,variant:used,shopId};
}

let priceTask=null,priceAt=0,variant=null;
const pending=new Map();
async function getPrices(force=false){
  if(force||!priceTask||Date.now()-priceAt>300000){
    priceAt=Date.now();
    priceTask=Promise.all([getGoogleAccessToken(),getSpreadsheetId()]).then(([token,id])=>fetchSheetValues('DS_SP!A:G',token,30000,id)).then(costMap).catch(e=>{priceTask=null;throw e;});
  }
  return priceTask;
}
// Sheet nháp: lưu tài chính đã đọc; lần sau đọc từ sheet, bấm ↻ thì đọc lại Shopee và ghi đè
const FIN_SHEET='NHAP_TAI_CHINH_DH';
const FIN_HEAD=['order_id','order_sn','shop_id','tong_tien_sp','doanh_thu','von','loi_nhuan','so_sp','thieu_von','chi_tiet','cap_nhat'];
let finTask=null,finWrite=Promise.resolve();
// Bản sao trên máy (chrome.storage) để trang đơn hiện ngay, không chờ đọc Google Sheet
const FIN_LOCAL='qlsp_fin_cache';
async function finLocal(entries){const old=(await chrome.storage.local.get(FIN_LOCAL))[FIN_LOCAL]||{};await chrome.storage.local.set({[FIN_LOCAL]:{...old,...entries}});}
const num=v=>v===''||v==null?null:Number(v);
function finRow(d){return [d.orderId,d.orderSn||'',d.shopId||'',d.merchandise??'',d.revenue??'',d.capital??'',d.profit??'',d.quantity||0,(d.missing||[]).join(', '),JSON.stringify(d.items||[]),new Date(d.at).toLocaleString('vi-VN')];}
function finData(r,at){
  let items=[];try{items=JSON.parse(r[9]||'[]');}catch{}
  return {ok:true,orderId:String(r[0]),orderSn:r[1],shopId:r[2],merchandise:num(r[3]),revenue:num(r[4]),capital:num(r[5]),profit:num(r[6]),quantity:Number(r[7])||0,missing:r[8]?String(r[8]).split(', '):[],items,at,fromSheet:true};
}
// Map order_id -> {row, data}; đọc sheet 1 lần (5 phút đọc lại)
function finSheet(){
  if(!finTask||Date.now()-finTask.at>300000){
    const t=(async()=>{
      const [token,id]=await Promise.all([getGoogleAccessToken(),getSpreadsheetId()]);
      const title=await ensureSheetExists(FIN_SHEET,token,id);
      const values=await fetchSheetValues(`'${title}'!A:K`,token,30000,id);
      const map=new Map();
      values.slice(1).forEach((r,i)=>{if(r[0])map.set(String(r[0]),{row:i+2,data:finData(r,Date.now())});});
      finLocal(Object.fromEntries([...map].map(([k,v])=>[k,v.data]))).catch(()=>{});
      return {title,map,next:Math.max(2,values.length+1),hasHead:String(values[0]?.[0]||'')==='order_id'};
    })();
    finTask={at:Date.now(),p:t.catch(e=>{finTask=null;throw e;})};
  }
  return finTask.p;
}
function saveFin(d){
  finWrite=finWrite.then(async()=>{
    const sheet=await finSheet(),[token,id]=await Promise.all([getGoogleAccessToken(),getSpreadsheetId()]);
    const put=async(range,values)=>{const {res,data}=await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({values})},30000);if(!res.ok)throw new Error(data.error?.message||'Không ghi được sheet nháp');};
    if(!sheet.hasHead){await put(`'${sheet.title}'!A1:K1`,[FIN_HEAD]);sheet.hasHead=true;}
    const old=sheet.map.get(d.orderId),row=old?old.row:sheet.next++;
    await put(`'${sheet.title}'!A${row}:K${row}`,[finRow(d)]);
    sheet.map.set(d.orderId,{row,data:{...d,fromSheet:true}});
    await finLocal({[d.orderId]:{...d,fromSheet:true}});
  }).catch(e=>console.warn('Lỗi ghi sheet nháp tài chính:',e));
  return finWrite;
}
async function load(msg,sender){
  if(msg.force!==true&&/^\d{5,20}$/.test(String(msg.orderId))){
    try{const hit=(await finSheet()).map.get(String(msg.orderId));if(hit)return hit.data;}catch(e){console.warn('Không đọc được sheet nháp tài chính:',e);}
  }
  const data=await loadShopee(msg,sender);
  // Chỉ lưu khi đã có doanh thu (đơn chưa có số liệu thì lần sau đọc lại Shopee)
  if(data.revenue!=null)saveFin(data);
  return data;
}
async function loadShopee(msg,sender){
  if(!sender.tab?.id||!/^https:\/\/banhang\.shopee\.vn\//.test(sender.url||sender.tab.url||'')||sender.frameId!==0)throw new Error('Chỉ hỗ trợ trang Kênh Người Bán chính');
  if(!/^\d{5,20}$/.test(String(msg.orderId)))throw new Error('ID đơn không hợp lệ');
  const tabId=sender.tab.id,key=`${tabId}:${sender.documentId||''}:${msg.orderId}`;
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    const cookie=await chrome.cookies.get({url:'https://banhang.shopee.vn',name:'SPC_CDS'});
    const costResult=getPrices(msg.force===true).then(prices=>({prices})).catch(e=>({costError:e.message}));
    const [injected]=await chrome.scripting.executeScript({target:{tabId,...(sender.documentId?{documentIds:[sender.documentId]}:{frameIds:[0]})},world:'MAIN',func:readOrderFinancialApi,args:[String(msg.orderId),cookie?.value||'',variant]});
    const result=injected?.result;if(!result?.detail)throw new Error('Không lấy được chi tiết đơn Shopee');
    variant=result.variant;
    const actual=findDeep(result.detail,['order_id'],v=>/^\d+$/.test(String(v)));
    if(actual&&String(actual)!==String(msg.orderId))throw new Error('Shopee trả ID đơn không khớp');
    const order=parseOrder({order_ext_info:{order_id:msg.orderId},card_header:{order_sn:msg.orderSn}},result.detail);
    const actualSn=findDeep(result.detail,['order_sn'],v=>typeof v==='string'&&v.length>8);
    if(actualSn&&msg.orderSn&&actualSn!==msg.orderSn)throw new Error('Shopee trả mã đơn không khớp');
    const {prices,costError}=await costResult;
    return {ok:true,orderId:String(msg.orderId),orderSn:actualSn||msg.orderSn,shopId:result.shopId,...financials(order,result.income?parseIncome(result.income):null,prices),incomeError:result.incomeError,costError,at:Date.now()};
  })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.type!=='QLSP_ORDER_LIST_FINANCE')return false;
  load(msg,sender).then(reply).catch(e=>reply({ok:false,error:e.message}));return true;
});
