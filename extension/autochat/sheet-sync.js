/* Đồng bộ chỉ đọc: không gọi tick/sendTo và không thay đổi chế độ tự gửi. */
importScripts('../shared/chat-sheet.js');
var AUTOCHAT_SHEET_SYNC = (() => {
  const S=self.AutoChatSheet, ALARM='autochat-sheet-sync';
  let task=null;
  async function saveTables(session, code, state) {
    const sheetId=self.SHARED_GOOGLE_CONFIG.webSpreadsheetId;
    if(!sheetId) throw new Error('Chưa cấu hình bảng tính web');
    const token=await getGoogleAccessToken();
    const data=S.tables(state,session,code,Date.now()), requests=[];
    for(const [title,headers,rows] of [[S.CUSTOMER_TITLE,S.CUSTOMER_HEADERS,data.customers],[S.MESSAGE_TITLE,S.MESSAGE_HEADERS,data.messages]]) {
      const actual=await ensureSheetExists(title,token,sheetId);
      const old=await fetchSheetValues(`'${actual}'!A:${headers.length===13?'M':'J'}`,token,30000,sheetId);
      const values=S.mergeShop(old,headers,rows,session.shopId);
      const meta=await fetchSpreadsheetMetadata(token,sheetId);
      const props=meta.sheets.find(x=>x.properties.title===actual).properties;
      const count=Math.max(values.length,old.length);
      if(count>props.gridProperties.rowCount) requests.push({appendDimension:{sheetId:props.sheetId,dimension:'ROWS',length:count-props.gridProperties.rowCount}});
      requests.push({updateCells:{range:{sheetId:props.sheetId,startRowIndex:0,endRowIndex:count,startColumnIndex:0,endColumnIndex:headers.length},rows:values.map(r=>({values:r.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')}}))})),fields:'userEnteredValue'}});
    }
    const {res,data:reply}=await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requests})});
    if(!res.ok) throw new Error(reply.error?.message || 'Không ghi được sheet chat');
  }
  function arrayPage(data) {
    if(!Array.isArray(data)) throw new Error('Shopee trả cấu trúc danh sách chat khác dự kiến; chưa đánh dấu đã tải hết');
    return data;
  }
  async function run() {
    const session=(await AUTOCHAT_ENGINE.syncSessionFromTab()) || await AUTOCHAT.getSession();
    if(!session?.token || !session.shopId) throw new Error('Mở Shopee đã đăng nhập rồi bấm Lấy lại phiên trong Auto Chat');
    const cfg=await chrome.storage.local.get(['tcdd-shop-code','maGian','dhHoanTextValue']);
    const code=String(cfg['tcdd-shop-code'] || cfg.maGian || cfg.dhHoanTextValue || '').trim().toUpperCase();
    if(!code) throw new Error('Nhập Mã gian trong Auto In để gắn đúng gian cho chat');
    const stateKey='autochat_export_'+session.shopId, sentKey='autochat_sent_'+session.shopId;
    const stored=await chrome.storage.local.get([stateKey,sentKey]);
    const state=stored[stateKey] || {conversations:{},messages:{},pending:[],offset:0,indexDone:false};
    const sent=stored[sentKey] || {}, queue=await AUTOCHAT.getQueue();
    if(state.indexDone && Date.now()-(state.indexAt||0)>5*60000) {state.indexDone=false;state.offset=0;state.pageFingerprint='';}
    let warning='';
    if(!state.indexDone) {
      const list=arrayPage(await AUTOCHAT_ENGINE.readConversationsPage(session,state.offset));
      const fingerprint=list.map(c=>c.id).join('|');
      if(list.length && state.offset && state.pageFingerprint===fingerprint) warning='Shopee lặp trang danh sách khách. Đã giữ dữ liệu; chưa xác nhận lấy đủ tất cả khách.';
      else {
        S.applyPage(state,list,session,sent,queue,Date.now());
        state.pageFingerprint=fingerprint;
        state.offset+=list.length;
        // Danh sách xếp theo tin mới nhất: gặp khách cũ hơn 7 ngày thì không cần quét tiếp.
        const oldest=list.length?S.millis(list[list.length-1].last_message_time):0;
        if(list.length<50 || oldest<Date.now()-S.KEEP_MS) {state.indexDone=true;state.indexAt=Date.now();}
      }
    }
    for(let i=0;i<5 && state.pending.length;i++) {
      const id=state.pending[0], c=state.conversations[id];
      try {
        const list=arrayPage(await AUTOCHAT_ENGINE.readMessagesPage(session,id,c.offset||0));
        const fingerprint=list.map(m=>m.id || m.message_id).join('|');
        if(list.length && c.offset && c.pageFingerprint===fingerprint) throw new Error('Shopee lặp trang lịch sử, chưa tải đủ');
        S.addMessages(state,id,list,session,sent,Date.now());
        c.pageFingerprint=fingerprint;c.offset=(c.offset||0)+list.length;c.historyError='';
        if(list.length<20) {c.historyDone=true;state.pending.shift();}
        else {state.pending.push(state.pending.shift());}
      } catch(e) {
        c.historyError=e.message;
        warning=`Hội thoại ${c.name}: ${e.message}`;
        state.pending.push(state.pending.shift());
      }
    }
    for(const c of Object.values(state.conversations)) c.autoAt=sent[c.id]?.at || queue[c.id]?.greet?.sentAt || c.autoAt || 0;
    S.prune(state,Date.now());
    state.warning=warning;
    await chrome.storage.local.set({[stateKey]:state});
    await saveTables(session,code,state);
    const meta={at:Date.now(),code,shopId:session.shopId,customers:Object.keys(state.conversations).length,pending:state.pending.length,indexDone:state.indexDone,error:warning};
    await chrome.storage.local.set({autochat_sheet_meta:meta,autochat_sheet_error:""});
    return {ok:true,...meta};
  }
  function sync() {
    if(task)return task;
    task=run().catch(async e=>{await chrome.storage.local.set({autochat_sheet_error:e.message});return {ok:false,error:e.message};}).finally(()=>{task=null;});
    return task;
  }
  chrome.alarms.create(ALARM,{periodInMinutes:1});
  chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)sync();});
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(msg?.type!=='autochat-sync-sheet')return false;
    sync().then(reply);return true;
  });
  return {sync};
})();
