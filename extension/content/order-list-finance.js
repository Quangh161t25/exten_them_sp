(() => {
  if(window.top!==window)return;
  const ids=new Map(),cache=new Map(),inflight=new Set(),collapsed=new Map();let timer=null,queue=[],running=0,wmlUploaded=new Set();
  const WML_KEY='tcdd-wml-watch',FIN_LOCAL='qlsp_fin_cache';let finReady=false;
  // Tài chính đã lưu sheet nháp: bản sao trên máy, hiện ngay không gọi lại
  chrome.storage.local.get(FIN_LOCAL,data=>{for(const [id,d] of Object.entries(data?.[FIN_LOCAL]||{}))if(!cache.has(id))cache.set(id,d);finReady=true;document.querySelectorAll('.qlsp-order-finance').forEach(el=>{const d=cache.get(el.dataset.orderId);if(d)draw(el,d);});queue=queue.filter(t=>t.force||!cache.has(t.id));pump();});
  function updateWml(list){
    wmlUploaded=new Set((Array.isArray(list)?list:[]).filter(x=>Date.now()-x.at<7*24*60*60*1000).map(x=>String(x.order_sn)));
    document.querySelectorAll('.qlsp-order-finance').forEach(updateWmlBadge);
  }
  function updateWmlBadge(panel){
    const badge=panel.querySelector('.qlsp-finance-wml');if(badge)badge.hidden=!wmlUploaded.has(panel.dataset.orderSn);
  }
  chrome.storage.local.get(WML_KEY,data=>updateWml(data?.[WML_KEY]));
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[WML_KEY])updateWml(changes[WML_KEY].newValue);});
  const money=n=>n==null?'—':new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
  const onList=()=>/^\/portal\/sale\/order\/?$/.test(location.pathname);
  function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;scan();},350);}
  function findCard(sn){
    const known=sn.closest('.order-card,.order-item-wrapper,[data-testid="order-item"]');
    if(known&&known.querySelectorAll('span.order-sn').length===1)return known;
    for(let el=sn.parentElement;el&&el!==document.body;el=el.parentElement){
      if(el.querySelectorAll('span.order-sn').length>1)break;
      if(el.querySelector('.item-name,.item-card,.order-product-item,.product-info,[class*="product-name"],.order-body,.item-list'))return el;
    }
    // Không leo tới wrapper cả trang khi chỉ có một đơn.
    return sn.closest('[class*="order-card"],[class*="orderCard"]');
  }
  // Đầu khung: trạng thái đơn (đọc từ cột Trạng thái của thẻ); cuối khung: nhãn in xanh (ud-ct-badge) chuyển từ cột Thao tác xuống
  const STATUS_RE=/^(Chờ xác nhận|Chờ lấy hàng|Đang giao|Đã giao cho ĐVVC|Đã giao|Đã nhận được hàng|Đã hủy|Đơn hủy|Trả hàng\/Hoàn tiền|Trả hàng|Hoàn tiền|Giao không thành công|Hoàn thành)/;
  // Thẻ đơn có thể có 2 nhãn in (đầu thẻ + cột Thao tác): đưa nhãn đã có nội dung vào khung, nhãn còn lại bị CSS ẩn
  function moveBadge(card,panel){
    const inPanel=panel.querySelector('.ud-ct-badge');
    if(inPanel&&inPanel.textContent.trim())return;
    const cand=[...card.querySelectorAll('.ud-ct-badge')].filter(b=>!panel.contains(b));
    const best=cand.find(b=>b.textContent.trim())||(!inPanel&&cand[0]);
    if(!best)return;
    if(inPanel)inPanel.remove();
    panel.append(best);
  }
  function placeExtras(panel,keepBadge){
    const card=panel.parentElement;if(!card)return;
    const st=(card.innerText||'').split('\n').map(t=>t.trim()).find(t=>STATUS_RE.test(t));
    if(st){const chip=document.createElement('span');chip.className='qlsp-finance-status';chip.textContent=st.match(STATUS_RE)[0];panel.prepend(chip);}
    if(keepBadge)panel.append(keepBadge);
    moveBadge(card,panel);
  }
  function draw(panel,data){
    const keepBadge=panel.querySelector('.ud-ct-badge');
    drawInner(panel,data);
    placeExtras(panel,keepBadge);
  }
  function drawInner(panel,data){
    const keepBadge=panel.querySelector('.ud-ct-badge');
    panel.replaceChildren();
    const title=document.createElement('div');title.className='qlsp-finance-title';
    const heading=document.createElement('span');heading.className='qlsp-finance-heading';heading.textContent='Tài chính đơn hàng';
    const badge=document.createElement('span');badge.className='qlsp-finance-wml';badge.textContent='Đã in lên WML';badge.title='Đã ghi nhận nạp Wameli, cùng dữ liệu với Auto In';heading.append(badge);
    const actions=document.createElement('span');actions.className='qlsp-finance-actions';
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='↻';refresh.title='Tải lại doanh thu và giá vốn';
    refresh.onclick=e=>{e.preventDefault();e.stopPropagation();cache.delete(panel.dataset.orderId);enqueue(panel,true);};
    const toggle=document.createElement('button');toggle.type='button';
    const body=document.createElement('div');body.className='qlsp-finance-body';
    const applyCollapse=()=>{const closed=collapsed.get(panel.dataset.orderId)||false;body.hidden=closed;toggle.textContent=closed?'Mở rộng':'Thu gọn';toggle.setAttribute('aria-expanded',String(!closed));};
    toggle.onclick=e=>{e.preventDefault();e.stopPropagation();collapsed.set(panel.dataset.orderId,!body.hidden);applyCollapse();};applyCollapse();
    actions.append(toggle,refresh);title.append(heading,actions);panel.append(title,body);updateWmlBadge(panel);
    if(data?.error){const note=document.createElement('div');note.className='qlsp-finance-note';note.textContent=data.error;body.append(note);return;}
    const rows=[['Tổng tiền sản phẩm',data?.merchandise],['Doanh thu ước tính',data?.revenue],[`Tổng vốn (${data?.quantity||0} SP)`,data?.capital],['Lợi nhuận',data?.profit]];
    const grid=document.createElement('div');grid.className='qlsp-finance-grid';
    rows.forEach(([label,value],i)=>{const cell=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('strong');name.textContent=label;amount.textContent=data?money(value):'Đang tải…';if(i===3&&value!=null)amount.className=value<0?'negative':'positive';cell.append(name,amount);grid.append(cell);});body.append(grid);
    if(data){
      const notes=[];if(data.incomeError)notes.push(data.incomeError);if(data.costError)notes.push('Không đọc được giá vốn: '+data.costError);
      else if(data.missing?.length)notes.push('Thiếu giá vốn: '+data.missing.join(', '));
      if(!data.items?.length)notes.push('Chưa đọc được các dòng sản phẩm từ API');
      const note=document.createElement('div');note.className='qlsp-finance-note';note.textContent=notes.length?notes.join(' · '):(data.fromSheet?'Đọc từ sheet NHAP_TAI_CHINH_DH · bấm ↻ để đọc lại Shopee':'Ước tính · Vốn theo gia_ban / DS_SP · Cập nhật '+new Date(data.at).toLocaleTimeString('vi-VN')+' · đã lưu sheet nháp');body.append(note);panel.title=note.textContent;
      if(data.items?.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Chi tiết giá vốn';details.append(summary);data.items.forEach(it=>{const line=document.createElement('div');line.textContent=`${it.sku||it.name||'Chưa có SKU'} × ${it.qty}: ${money(it.cost)}`;details.append(line);});body.append(details);}
    }
  }
  function enqueue(panel,force=false){
    const id=panel.dataset.orderId;if(inflight.has(id)||queue.some(t=>t.id===id))return;
    const previous=cache.get(id);if(!force&&previous){draw(panel,previous);return;}
    draw(panel,null);queue.push({id,sn:panel.dataset.orderSn,panel,force});pump();
  }
  function pump(){
    if(!finReady)return;
    while(running<2&&queue.length){const {id,sn,panel,force}=queue.shift();if(!panel.isConnected||!onList())continue;
      running++;inflight.add(id);
      chrome.runtime.sendMessage({type:'QLSP_ORDER_LIST_FINANCE',orderId:id,orderSn:sn,force},reply=>{
        const error=chrome.runtime.lastError?.message;const data=error?{error}:reply?.ok?reply:{error:reply?.error||'Không tải được dữ liệu. Bấm ↻ để thử lại.'};
        cache.set(id,data);
        document.querySelectorAll('.qlsp-order-finance').forEach(el=>{if(el.dataset.orderId===id)draw(el,data);});
        running--;inflight.delete(id);setTimeout(pump,200);
      });
    }
  }
  function scan(){
    document.documentElement?.classList.toggle('qlsp-fin-list',onList()); // CSS: ẩn nhãn in ở cột Thao tác, chỉ hiện trong khung tài chính
    if(!onList()){queue=[];document.querySelectorAll('.qlsp-order-finance').forEach(el=>el.remove());return;}
    for(const sn of document.querySelectorAll('span.order-sn')){
      const text=(sn.textContent||'').match(/\b\d{6}[A-Z0-9]{6,24}\b/i)?.[0]?.toUpperCase();if(!text)continue;
      const card=findCard(sn);if(!card)continue;
      const link=card.querySelector('a[href*="/portal/sale/order/"]');
      const id=ids.get(text)||link?.getAttribute('href')?.match(/\/order\/(\d{5,20})(?:[/?#]|$)/)?.[1];
      let panel=card.querySelector('.qlsp-order-finance');
      if(panel&&(panel.dataset.orderSn!==text||panel.dataset.orderId!==(id||''))){panel.remove();panel=null;}
      if(panel){moveBadge(card,panel);continue;} // nhãn in tạo / điền sau khung: chuyển xuống
      panel=document.createElement('section');panel.className='qlsp-order-finance';panel.dataset.orderSn=text;panel.dataset.orderId=id||'';
      // Thẻ đơn là khối lớn nhất chỉ có một span.order-sn; khung tài chính nằm cuối khối.
      card.append(panel);
      if(id)enqueue(panel);else{panel.textContent='Đang chờ ID đơn từ Shopee. Tải lại trang nếu dòng này chưa có số liệu.';}
    }
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.channel!=='QLSP_FINANCE_IDS'||!Array.isArray(e.data.ids))return;
    for(const x of e.data.ids)if(/^[A-Z0-9]{10,30}$/.test(x.sn)&&/^\d{5,20}$/.test(x.id))ids.set(x.sn,x.id);
    while(ids.size>1000)ids.delete(ids.keys().next().value);schedule();
  });
  const style=document.createElement('style');style.textContent=`.qlsp-order-finance{box-sizing:border-box;clear:both;padding:10px 14px;margin:8px 12px 12px;background:#f8fafc;border:1px solid #dce5ee;border-radius:6px;font:12px/1.5 Arial,sans-serif;color:#334155;flex-basis:100%;text-align:left}.qlsp-finance-title{font-weight:600;display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.qlsp-finance-title button{border:1px solid #cbd5e1;background:white;border-radius:4px;padding:0 7px;color:#475569;cursor:pointer}.qlsp-finance-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:8px}.qlsp-finance-grid span{display:block;color:#64748b;font-size:11px}.qlsp-finance-grid strong{display:block;font-size:14px;font-weight:600;color:#0f172a}.qlsp-finance-grid .positive{color:#15803d}.qlsp-finance-grid .negative{color:#dc2626}.qlsp-finance-note{color:#64748b;font-size:10px;margin-top:6px;overflow-wrap:anywhere}.qlsp-order-finance details{font-size:11px;margin-top:5px;overflow-wrap:anywhere}.qlsp-order-finance summary{cursor:pointer;color:#475569}@media(max-width:900px){.qlsp-finance-grid{grid-template-columns:repeat(2,minmax(120px,1fr))}}`;document.head.append(style);
  style.textContent+=`.qlsp-finance-heading,.qlsp-finance-actions{display:inline-flex;align-items:center;gap:8px}.qlsp-finance-wml{display:inline-block;background:#0284c7;color:white;font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px}.qlsp-order-finance [hidden]{display:none!important}`;
  const observer=new MutationObserver(mutations=>{
    if(mutations.every(m=>m.target.closest?.('.qlsp-order-finance')||[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType===1&&n.classList?.contains('qlsp-order-finance'))))return;
    schedule();
  });observer.observe(document.body,{childList:true,subtree:true});
  window.postMessage({channel:'QLSP_FINANCE_IDS_REQUEST'},location.origin);schedule();
})();
// Gọn: 1 dòng — tiêu đề · 4 số liệu · nút; ghi chú nguồn số liệu hiện khi rê chuột vào khung
(()=>{const s=document.createElement('style');s.textContent=`.qlsp-order-finance{display:flex;flex-wrap:wrap;align-items:center;gap:2px 14px;padding:4px 10px!important;margin:4px 12px 8px!important;font-size:12px!important}.qlsp-finance-title{display:contents}.qlsp-finance-heading{font-size:12px;color:#475569}.qlsp-finance-actions{order:9;margin-left:auto}.qlsp-finance-title button{font-size:11px;line-height:18px}.qlsp-finance-body{display:flex;flex-wrap:wrap;align-items:center;gap:2px 14px}.qlsp-finance-grid{display:flex!important;flex-wrap:wrap;gap:2px 16px!important}.qlsp-finance-grid>div{display:flex;align-items:baseline;gap:4px}.qlsp-finance-grid span{display:inline!important;font-size:11px!important}.qlsp-finance-grid strong{display:inline!important;font-size:13px!important}.qlsp-finance-note{display:none}.qlsp-order-finance details{margin:0!important}.qlsp-order-finance details[open]{flex-basis:100%}`;document.head.append(s);
})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-finance-status{order:-1;background:#e0f2fe;color:#0369a1;font-weight:600;font-size:11px;padding:1px 7px;border-radius:10px;white-space:nowrap}.qlsp-order-finance .ud-ct-badge{order:8;font-size:11px!important;padding:1px 6px!important}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-fin-list .ud-ct-badge{visibility:hidden}.qlsp-fin-list .qlsp-order-finance .ud-ct-badge{visibility:visible}';document.head.append(s);try{document.documentElement.classList.toggle('qlsp-fin-list',location.pathname.split('/').filter(Boolean).join('/')==='portal/sale/order');}catch(e){}})();
