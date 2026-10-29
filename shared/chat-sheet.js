(() => {
  const CUSTOMER_TITLE = 'AUTO_CHAT', MESSAGE_TITLE = 'NOI_DUNG_CHAT';
  const CUSTOMER_HEADERS = ['Mã gian','ID shop','ID hội thoại','ID khách','Tên khách','Chưa tự chat','Đã tự chat','Lần tự chat gần nhất','Tin gần nhất','Người nhắn cuối','Thời gian tin cuối','Lịch sử','Đồng bộ lúc'];
  const MESSAGE_HEADERS = ['Mã gian','ID shop','ID hội thoại','ID tin','Thời gian','Người gửi','Loại tin','Nội dung','Auto Chat','Đồng bộ lúc'];
  const KEEP_MS = 7 * 86400000; // chỉ giữ khách có tin nhắn trong 7 ngày gần nhất
  const millis = (value) => { if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value)) return Date.parse(value) || 0;const n=Number(value)||0;return n>1e14?Math.floor(n/1e6):n>1e11?n:n*1000; };
  function text(type, content) {
    if (typeof content === 'string') { try { content=JSON.parse(content); } catch { return content; } }
    if(content?.text) return String(content.text);
    return ({image:'[Hình ảnh]',video:'[Video]',item:'[Sản phẩm]',product:'[Sản phẩm]',order:'[Đơn hàng]',sticker:'[Sticker]',voucher:'[Voucher]'})[type] || '['+(type || 'Tin nhắn')+']';
  }
  function applyPage(state, list, session, sent, queue, at) {
    for(const c of list) {
      if(!c?.id || !c.to_id || c.official_chat?.official_conv_type) continue;
      if(millis(c.last_message_time) < at-KEEP_MS) continue;
      const key=String(c.id), old=state.conversations[key] || {};
      const evidence=sent[key]?.at || queue[key]?.greet?.sentAt || old.autoAt || 0;
      state.conversations[key]={...old,id:key,buyerId:String(c.to_id),name:c.to_name || old.name || '',lastId:String(c.latest_message_id || ''),lastAt:millis(c.last_message_time),lastText:text(c.latest_message_type,c.latest_message_content),lastFrom:String(c.latest_message_from_id)===String(c.to_id)?'Khách':'Shop',autoAt:evidence,at};
      if(!old.historyDone || old.lastId!==String(c.latest_message_id||'')) {
        if(!state.pending.includes(key)) state.pending.push(key);
        state.conversations[key].offset=old.lastId!==String(c.latest_message_id||'')?0:(old.offset||0);
        state.conversations[key].historyDone=false;
      }
    }
  }
  function addMessages(state, convId, list, session, sent, at) {
    const target=state.messages[convId] ||= {};
    let added=0;
    for(const m of list) {
      const id=String(m.id || m.message_id || ''); if(!id) throw new Error('Shopee trả tin không có ID; chưa xác nhận đủ lịch sử');
      if(!target[id]) added++;
      const body=text(m.type,m.content);
      target[id]={id,at:millis(m.created_timestamp || m.created_time),from:String(m.from_id)===String(session.userId)?'Shop':'Khách',type:m.type || 'text',text:body,auto:!!(target[id]?.auto || (sent[convId]?.messageId && String(sent[convId].messageId)===id))};
    }
    return added;
  }
  function tables(state, session, code, at) {
    const customers=[], messages=[];
    for(const c of Object.values(state.conversations)) {
      customers.push([code,String(session.shopId),c.id,c.buyerId,c.name,c.autoAt?'':'Chưa tự chat',c.autoAt?'Đã tự chat':'',c.autoAt||0,c.lastText,c.lastFrom,c.lastAt,c.historyError?'Chưa tải đủ: '+c.historyError:c.historyDone?'Đã tải hết':'Đang tải lịch sử',at]);
      for(const m of Object.values(state.messages[c.id] || {})) messages.push([code,String(session.shopId),c.id,m.id,m.at,m.from,m.type,m.text,m.auto?'Auto Chat':'',at]);
    }
    const progress = state.indexDone?`Đã quét hết danh sách · ${state.pending.length} hội thoại đang tải`:`Đang quét danh sách · đã lấy ${Object.keys(state.conversations).length} khách · ${state.pending.length} hội thoại đang tải`;
    customers.push([code,String(session.shopId),'__SYNC__','','','','',0,'','',0,progress+(state.warning?' · '+state.warning:''),at]);
    return {customers,messages};
  }
  // Bỏ khách không nhắn tin trong 7 ngày (cùng lịch sử và hàng chờ tải) để không đồng bộ lên sheet nữa.
  function prune(state, at) {
    for(const [id,c] of Object.entries(state.conversations)) {
      if((c.lastAt||0) >= at-KEEP_MS) continue;
      delete state.conversations[id]; delete state.messages[id];
    }
    state.pending=state.pending.filter(id=>state.conversations[id]);
  }
  function mergeShop(previous, headers, rows, shopId) {
    if(previous.length && JSON.stringify(previous[0])!==JSON.stringify(headers)) throw new Error('Cột sheet chat không đúng cấu trúc; giữ dữ liệu cũ');
    return [headers,...previous.slice(1).filter(r=>String(r[1])!==String(shopId)),...rows];
  }
  globalThis.AutoChatSheet={KEEP_MS,prune,CUSTOMER_TITLE,MESSAGE_TITLE,CUSTOMER_HEADERS,MESSAGE_HEADERS,millis,text,applyPage,addMessages,tables,mergeShop};
})();
