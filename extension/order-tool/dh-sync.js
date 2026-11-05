import {orders as api,getShopInfo} from './shopee-api.js';
import {parseOrder,parseIncome,findDeep} from './orders.js';
import {costMap} from './list-finance.js';
import {RAW_HEADERS,recordsForOrder,keyPlan,KEY_COLS,terminal} from '../../shared/dh-sheet.js';

const ALARM='dh-all-orders-sheet',CFG='dh_sheet_enabled';
let running=null,wantRecent=false; // wantRecent: tab Đơn Shopee vừa có đơn mới
const cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')}});
export async function writeOrders(records) {
  const spreadsheetId=self.SHARED_GOOGLE_CONFIG.webSpreadsheetId,token=await getGoogleAccessToken();
  const title=await ensureSheetExists('DH',token,spreadsheetId);
  const meta=await fetchSpreadsheetMetadata(token,spreadsheetId),p=meta.sheets.find(s=>s.properties.title===title).properties;
  const rangeTitle=`'${title.replace(/'/g,"''")}'`;
  const [headers=[]]=await fetchSheetValues(`${rangeTitle}!1:1`,token,30000,spreadsheetId);
  if(headers.length&&(!headers.includes('mdh')||!headers.includes('gian')))throw new Error('Sheet DH thiếu cột mdh/gian; giữ nguyên dữ liệu, không ghi');
  // Chỉ đọc các cột khóa nhẹ, không đọc các cột dữ liệu gốc
  const letter=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const columns={};
  // Một request batchGet cho mọi cột khóa (tránh vượt quota đọc/phút của Google)
  const keyCols=KEY_COLS.filter(h=>headers.includes(h));
  if(keyCols.length){
    const ranges=keyCols.map(h=>'ranges='+encodeURIComponent(`${rangeTitle}!${letter(headers.indexOf(h))}2:${letter(headers.indexOf(h))}`)).join('&');
    const {res,data}=await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}&majorDimension=COLUMNS`,{headers:{Authorization:`Bearer ${token}`}},60000);
    if(!res.ok)throw new Error(data.error?.message||'Không đọc được cột khóa DH');
    keyCols.forEach((h,i)=>{columns[h]=data.valueRanges?.[i]?.values?.[0]||[];});
  }
  const plan=keyPlan(headers,columns,records),requests=[];
  if(!plan.updates.length)return plan;
  if(p.gridProperties.columnCount<plan.headers.length)requests.push({appendDimension:{sheetId:p.sheetId,dimension:'COLUMNS',length:plan.headers.length-p.gridProperties.columnCount}});
  if(p.gridProperties.rowCount<plan.rowCount)requests.push({appendDimension:{sheetId:p.sheetId,dimension:'ROWS',length:plan.rowCount-p.gridProperties.rowCount}});
  requests.push({updateCells:{start:{sheetId:p.sheetId,rowIndex:0,columnIndex:0},rows:[{values:plan.headers.map(cell)}],fields:'userEnteredValue'}});
  for(const update of plan.updates){
    // Một request cho từng đoạn cột liền nhau; cột do người dùng nhập không bị ghi lại.
    let start=-1,values=[];
    const flush=()=>{if(start>=0)requests.push({updateCells:{start:{sheetId:p.sheetId,rowIndex:update.row,columnIndex:start},rows:[{values}],fields:'userEnteredValue'}});start=-1;values=[];};
    plan.headers.forEach((h,i)=>{if(Object.hasOwn(update.data,h)){const v=update.data[h];if(String(v??'').length>49000)throw new Error(`Nội dung cột ${h} quá dài`);if(start<0)start=i;values.push(cell(v));}else flush();});flush();
  }
  requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
  const {res,data}=await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requests})},60000);
  if(!res.ok)throw new Error(data.error?.message||'Không ghi được DH');
  return plan;
}
const freshCursor=()=>({page:1,sentinel:'',pending:[],fingerprint:'',seen:0,total:0,complete:false});
async function takePage(cursor) {
  if(cursor.pending.length||cursor.complete)return;
  const page=await api.listIndex({tab:100,page:cursor.page,pageSize:40,sentinel:cursor.sentinel});
  if(!Array.isArray(page.index))throw new Error('Danh sách đơn Shopee không hợp lệ');
  const fingerprint=JSON.stringify(page.index);
  if(page.index.length&&cursor.page>1&&fingerprint===cursor.fingerprint)throw new Error('Shopee lặp trang; chưa xác nhận tải đủ đơn');
  if(!page.index.length&&cursor.seen<page.total)throw new Error('Shopee trả trang rỗng trước tổng số đơn; sẽ thử lại');
  cursor.total=page.total;cursor.pending=page.index;cursor.fingerprint=fingerprint;
  cursor.sentinel=page.sentinel;cursor.page++;
  cursor.lastPage=page.index.length<40;
  if(!page.index.length)cursor.complete=true;
}
async function run() {
  const cfg=await chrome.storage.local.get([CFG,'tcdd-shop-code','maGian','dhHoanTextValue']);
  if(cfg[CFG]===false)return {ok:true,paused:true};
  const code=String(cfg['tcdd-shop-code']||cfg.maGian||cfg.dhHoanTextValue||'').trim().toUpperCase();
  if(!code)throw new Error('Nhập Mã gian trong Auto In trước khi đồng bộ DH');
  const shop=await getShopInfo();if(!shop.shopId)throw new Error('Không xác định được shop Shopee');
  // Gắn mã gian với shop thật: không trộn lịch sử khi chuyển tài khoản.
  const key=`dh_sync_${shop.shopId}_${code}`,saved=await chrome.storage.local.get(key);
  const state=saved[key]||{history:freshCursor(),active:{},ticks:0};state.ticks++;
  if(state.history.complete&&Date.now()-(state.completedAt||0)>6*3600000)state.history=freshCursor();
  await takePage(state.history);
  const historyBatch=state.history.pending.slice(0,5);
  let indices=[...historyBatch];
  // Cập nhật đơn mới và đơn chưa kết thúc trong khi đang quét lịch sử cũ.
  if(state.ticks%5===1||wantRecent){wantRecent=false;const recent=await api.listIndex({tab:100,page:1,pageSize:5});indices.push(...recent.index);}
  const active=Object.values(state.active).filter(a=>!a.nextAt||a.nextAt<=Date.now()).sort((a,b)=>a.at-b.at).slice(0,3);
  indices.push(...active.map(a=>a.index));
  const indexId=x=>String(x?.order_id||x?.order_sn||'');
  indices=[...new Map(indices.map(x=>[indexId(x),x])).values()];
  if(indices.some(x=>!indexId(x)))throw new Error('Chỉ mục Shopee thiếu mã đơn');
  // Giá bán DS_SP cho cột gia_sp / tong_thanh_tien_sp / loi_nhuan; lỗi thì vẫn ghi đơn, bỏ trống các cột này
  let prices=null;
  try{const [token,id]=await Promise.all([getGoogleAccessToken(),getSpreadsheetId()]);prices=costMap(await fetchSheetValues('DS_SP!A:G',token,30000,id));}catch(e){console.warn('DH: không đọc được DS_SP',e);}
  const records=[],updates=[];let warnings=[];
  for(let i=0;i<indices.length;i+=5){
    const chunk=indices.slice(i,i+5),cards=await api.cards({tab:100,index:chunk});
    const parsed=cards.map(c=>parseOrder(c));
    if(chunk.some(x=>!parsed.some(o=>indexId(x)===String(o.orderId)||indexId(x)===o.orderSn)))throw new Error('Shopee trả thiếu đơn; giữ vị trí để tải lại');
    for(const card of cards){
      let o=parseOrder(card);if(!o.orderId)throw new Error('Đơn thiếu ID chi tiết');
      try {o=parseOrder(card,await api.getOne(o.orderId));}catch(e){o.detailError=e.message;}
      try {o.incomeRaw=await api.income(o.orderId);o.income=parseIncome(o.incomeRaw);}catch(e){o.incomeError=e.message;}
      records.push(...recordsForOrder(o,shop,code,findDeep,Date.now(),prices));
      if(o.detailError||o.incomeError)warnings.push(o.orderSn);
      const index=chunk.find(x=>indexId(x)===String(o.orderId)||indexId(x)===o.orderSn);
      updates.push({id:o.orderId,index,status:o.status,retry:!!(o.detailError||o.incomeError)});
    }
  }
  // Kiểm tra lại tài khoản trước khi ghi; không gán đơn shop khác vào mã gian cũ.
  const check=await getShopInfo();if(String(check.shopId)!==String(shop.shopId))throw new Error('Shop đã thay đổi trong lúc tải. Chưa ghi DH, hãy thử lại');
  await writeOrders(records);
  for(const x of updates){if(!terminal(x.status)||x.retry)state.active[x.id]={index:x.index,at:Date.now(),nextAt:Date.now()+(terminal(x.status)?3600000:300000)};else delete state.active[x.id];}
  state.history.pending.splice(0,historyBatch.length);state.history.seen+=historyBatch.length;
  if(!state.history.pending.length&&state.history.lastPage){
    if(state.history.seen<state.history.total)throw new Error('Chưa đủ tổng số đơn Shopee; không đánh dấu hoàn tất');
    state.history.complete=true;state.completedAt=Date.now();
  }
  const info={at:Date.now(),code,shopId:shop.shopId,seen:state.history.seen,total:state.history.total,complete:state.history.complete,warning:warnings.length?`${warnings.length} đơn chưa có đủ chi tiết/doanh thu; sẽ thử lại`:''};
  await chrome.storage.local.set({[key]:state,dh_sheet_meta:info,dh_sheet_error:''});
  return {ok:true,...info};
}
// Tab "Đơn trên Sheet": đọc lại từ Shopee các đơn đang xem (theo order_id) rồi ghi DH.
// Chỉ đơn của shop đang đăng nhập; đơn shop khác bỏ qua.
async function reloadOrders(orderIds,shopId){
  const cfg=await chrome.storage.local.get(['tcdd-shop-code','maGian','dhHoanTextValue']);
  const code=String(cfg['tcdd-shop-code']||cfg.maGian||cfg.dhHoanTextValue||'').trim().toUpperCase();
  if(!code)throw new Error('Nhập Mã gian trong Auto In trước');
  const shop=await getShopInfo();if(!shop.shopId)throw new Error('Chưa mở/đăng nhập Kênh Người Bán Shopee');
  if(shopId&&String(shopId)!==String(shop.shopId))throw new Error('Các đơn này thuộc shop khác shop đang đăng nhập Shopee');
  let prices=null;
  try{const [token,id]=await Promise.all([getGoogleAccessToken(),getSpreadsheetId()]);prices=costMap(await fetchSheetValues('DS_SP!A:G',token,30000,id));}catch(e){console.warn('DH: không đọc được DS_SP',e);}
  const ids=[...new Set(orderIds.map(String).filter(x=>/^\d+$/.test(x)))];
  const records=[];let ok=0,fail=0;
  for(let i=0;i<ids.length;i+=5){
    const chunk=ids.slice(i,i+5);
    // Shopee có thể báo "parameter invalid" khi chỉ có order_id: bỏ qua, dựng card từ chi tiết đơn bên dưới
    let cards=[];
    try{cards=await api.cards({tab:100,index:chunk.map(id=>({order_id:Number(id)}))});}catch(e){console.warn('DH: không đọc được card',e);}
    // Đơn Shopee không trả card (đơn cũ ngoài danh sách): dựng card tối thiểu, lấy dữ liệu từ chi tiết đơn
    for(const id of chunk)if(!cards.some(c=>String(parseOrder(c).orderId)===id))cards.push({order_ext_info:{order_id:Number(id)}});
    for(const card of cards){
      let o=parseOrder(card);if(!o.orderId){fail++;continue;}
      try{const d=await api.getOne(o.orderId);o=parseOrder(card,d);o.orderSn||=findDeep(d,['order_sn'],v=>typeof v==='string'&&v.length>8)||'';}catch(e){o.detailError=e.message;}
      try{o.incomeRaw=await api.income(o.orderId);o.income=parseIncome(o.incomeRaw);}catch(e){o.incomeError=e.message;}
      try{
        const rs=recordsForOrder(o,shop,code,findDeep,Date.now(),prices);
        // Không đọc được trạng thái (thiếu card): giữ trạng thái đang có trên sheet
        if(!o.status)rs.forEach(r=>{delete r.trang_thai;delete r.mo_ta_trang_thai;delete r.ma_trang_thai;});
        records.push(...rs);ok++;
      }catch{fail++;}
    }
  }
  const check=await getShopInfo();if(String(check.shopId)!==String(shop.shopId))throw new Error('Shop đã thay đổi trong lúc tải, chưa ghi DH');
  if(records.length)await writeOrders(records);
  await chrome.storage.local.set({dh_sheet_meta:{...(await chrome.storage.local.get('dh_sheet_meta')).dh_sheet_meta,reloadAt:Date.now()}});
  return {ok:true,count:ok,fail};
}
// Tab "Đơn Shopee" gửi thẳng các đơn đã tải (có chi tiết + doanh thu) để ghi DH, không gọi lại Shopee.
// Gửi nhiều đợt cùng batch: gom bản ghi, chỉ đọc/ghi Google 1 lần ở đợt cuối (last).
const batches=new Map();
async function writeLoaded(orders,batch,last=true){
  let b=batch&&batches.get(batch);
  if(!b){
    const cfg=await chrome.storage.local.get(['tcdd-shop-code','maGian','dhHoanTextValue']);
    const code=String(cfg['tcdd-shop-code']||cfg.maGian||cfg.dhHoanTextValue||'').trim().toUpperCase();
    if(!code)throw new Error('Nhập Mã gian trong Auto In trước');
    const shop=await getShopInfo();if(!shop.shopId)throw new Error('Chưa mở/đăng nhập Kênh Người Bán Shopee');
    let prices=null;
    try{const [token,id]=await Promise.all([getGoogleAccessToken(),getSpreadsheetId()]);prices=costMap(await fetchSheetValues('DS_SP!A:G',token,30000,id));}catch(e){console.warn('DH: không đọc được DS_SP',e);}
    b={code,shop,prices,records:[],count:0,skipped:0};
    if(batch)batches.set(batch,b);
  }
  for(const o of orders){try{b.records.push(...recordsForOrder(o,b.shop,b.code,findDeep,Date.now(),b.prices));b.count++;}catch{b.skipped++;}}
  if(!last)return {ok:true,count:b.count,pending:true};
  if(batch)batches.delete(batch);
  const {records,skipped}=b;orders={length:b.count+b.skipped};
  const plan=records.length?await writeOrders(records):null;
  await chrome.storage.local.set({dh_sheet_meta:{...(await chrome.storage.local.get('dh_sheet_meta')).dh_sheet_meta,pushAt:Date.now()}});
  return {ok:true,count:orders.length-skipped,skipped,appended:plan?.appended||0,updated:plan?.updated||0,unchanged:plan?.unchanged||0};
}
function sync(){if(running)return running;running=run().catch(async e=>{await chrome.storage.local.set({dh_sheet_error:e.message});return {ok:false,error:e.message};}).finally(()=>running=null);return running;}
// Đã tắt quét lịch sử chạy nền: sheet DH nhận đơn từ tab Đơn Shopee (dh-write-orders)
chrome.alarms.clear(ALARM);
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.type==='dh-write-orders'){writeLoaded(msg.orders||[],msg.batch,msg.last!==false).then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}
  if(msg?.type==='dh-reload-orders'){reloadOrders(msg.orderIds||[],msg.shopId).then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}
  if(msg?.type==='dh-sync-sheet'){if(msg.recent)wantRecent=true;sync().then(reply);return true;}
  return false;
});
