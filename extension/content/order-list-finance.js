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
    const findSt=(el)=>(el?.innerText||'').split('\n').map(t=>t.trim()).find(t=>STATUS_RE.test(t));
    let st=findSt(card);
    for(let el=card.parentElement,i=0;!st&&el&&i<3;el=el.parentElement,i++){
      if(el.querySelectorAll('span.order-sn').length>1)break;
      st=findSt(el);
    }
    // Đang ở tab "Chờ lấy hàng" (type=toship) mà thẻ không ghi trạng thái → coi là Chờ lấy hàng
    if(!st&&/[?&]type=toship\b/.test(location.search))st='Chờ lấy hàng';
    if(st){const chip=document.createElement('span');chip.className='qlsp-finance-status';chip.textContent=st.match(STATUS_RE)[0];panel.prepend(chip);}
    // Đơn "Chờ lấy hàng": nút Xác nhận lấy hàng / Chạy đơn (xác nhận nếu cần + in + nạp Wameli) – dùng Auto In
    if(st&&/^Chờ lấy hàng/.test(st)&&panel.dataset.orderSn)addRunButtons(panel);
    if(keepBadge)panel.append(keepBadge);
    moveBadge(card,panel);
  }
  const SKU_OV='tcdd-sku-override';
  const runOne=(sn,confirmOnly)=>new Promise(res=>chrome.runtime.sendMessage({type:'tcdd-single-order',order_sn:sn,confirmOnly},r=>{
    const err=chrome.runtime.lastError?.message;res({ok:!err&&r&&r.ok,text:err||(r&&r.text)||''});}));
  // Kho của đơn Chưa xử lý (hỏi background, nhớ 60 giây) → tô màu nút Xác nhận
  let whMap=null,whAt=0,whTask=null;
  function pendingWh(){
    if(whMap&&Date.now()-whAt<60e3)return Promise.resolve(whMap);
    if(whTask)return whTask;
    whTask=new Promise(res=>chrome.runtime.sendMessage({type:'tcdd-pending-wh'},r=>{
      whTask=null;if(!chrome.runtime.lastError&&r&&r.ok){whMap=r.map||{};whAt=Date.now();}res(whMap||{});}));
    return whTask;
  }
  const isHcm=(name)=>/hồ chí minh|hcm|tp\.?\s*hcm|sài gòn/i.test(name||'');
  function paintWh(btn,sn){
    pendingWh().then(map=>{
      const wh=map[sn];if(!wh||!btn.isConnected)return;
      const hcm=isHcm(wh);
      btn.classList.toggle('qlsp-hcm',hcm);
      btn.textContent=hcm?'✅ Xác nhận lấy hàng · HCM':'✅ Xác nhận lấy hàng · HN';
      btn.dataset.label=btn.textContent;
      btn.title=`Kho: ${wh} · gửi yêu cầu lấy hàng cho đơn này`;
    });
  }
  function addRunButtons(panel){
    const acts=panel.querySelector('.qlsp-finance-actions');
    if(!acts||acts.querySelector('.qlsp-run'))return;
    const sn=panel.dataset.orderSn;
    const mk=(label,title,confirmOnly)=>{
      const b=document.createElement('button');b.type='button';b.className='qlsp-run';b.textContent=label;b.title=title;
      b.dataset.kind=confirmOnly?'confirm':'run';b.dataset.label=label;
      b.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        if(!confirm(confirmOnly?`Xác nhận lấy hàng đơn ${sn}?`:`Chạy đơn ${sn}?\n(Xác nhận lấy hàng nếu chưa, tạo phiếu in, tải PDF/Excel và nạp lên Wameli)`))return;
        panel.querySelectorAll('.qlsp-run').forEach(x=>x.disabled=true);
        b.textContent='Đang chạy…';
        runOne(sn,confirmOnly).then(({ok,text})=>{
          b.textContent=ok?'✓ Xong':'✗ Lỗi';
          b.title=text||title;
          panel.querySelectorAll('.qlsp-run').forEach(x=>x.disabled=false);
          if(!ok)alert(text||'Không chạy được đơn');
          setTimeout(()=>{b.textContent=b.dataset.label||label;},4000);
        });
      };
      return b;
    };
    // Chưa xử lý (thẻ có nút "Chuẩn bị hàng") → Xác nhận lấy hàng; Đã xử lý (có "In phiếu giao") → Chạy đơn
    // Đọc chữ của cả thẻ đơn (leo lên khối chỉ chứa 1 mã đơn) vì cột "Thao tác" có thể nằm ngoài khối thẻ hẹp
    let text=panel.parentElement?.innerText||'';
    for(let el=panel.parentElement?.parentElement,i=0;el&&i<3;el=el.parentElement,i++){
      if(el.querySelectorAll('span.order-sn').length>1)break;
      text=el.innerText||text;
    }
    // Dự phòng theo tab đang mở: source=processed → Đã xử lý; source=to_process → Chưa xử lý
    const src=(location.search.match(/[?&]source=([^&]+)/)||[])[1]||'';
    let processed=/In phiếu giao/i.test(text);
    let toProcess=/Chuẩn bị hàng/i.test(text);
    if(!processed&&!toProcess){ if(src==='processed')processed=true; else if(src==='to_process')toProcess=true; else return; }
    if(toProcess&&!processed){const b=mk('✅ Xác nhận lấy hàng','Gửi yêu cầu lấy hàng cho đơn này (ngày sớm nhất, địa chỉ lấy hàng của Auto In)',true);acts.prepend(b);paintWh(b,sn);}
    else if(processed)acts.prepend(mk('⚡ Chạy đơn','Tạo phiếu in, tải PDF/Excel → nạp Wameli cho đơn này',false));
  }
  // ---- Nút hàng loạt: chạy các đơn đã tích ô chọn; không tích đơn nào = tất cả đơn đủ điều kiện trên trang ----
  // Mã đơn của 1 ô tích: leo lên tới khối chỉ chứa đúng 1 span.order-sn
  function snOfCheckbox(c){
    for(let el=c.parentElement;el&&el!==document.body;el=el.parentElement){
      const sns=el.querySelectorAll('span.order-sn');
      if(sns.length>1)return '';
      if(sns.length===1){const m=(sns[0].textContent||'').match(/\b\d{6}[A-Z0-9]{6,24}\b/i);return m?m[0].toUpperCase():'';}
    }
    return '';
  }
  function bulkTargets(kind){
    const panelOf=(sn)=>[...document.querySelectorAll('.qlsp-order-finance')].find(p=>p.dataset.orderSn===sn);
    // 1) Có tích ô chọn → đúng các đơn đã tích (kể cả đơn khung chưa hiện nút)
    const checked=[...new Set([...document.querySelectorAll('input[type=checkbox]')]
      .filter(c=>c.checked&&!c.closest('.qlsp-order-finance,#qlsp-bulk')).map(snOfCheckbox).filter(Boolean))];
    if(checked.length)return checked.map(sn=>({sn,btn:panelOf(sn)?.querySelector('.qlsp-run')||null}));
    // 2) Không tích → mọi đơn đủ điều kiện (có nút tương ứng) trên trang
    return [...document.querySelectorAll(`.qlsp-order-finance .qlsp-run[data-kind="${kind}"]`)]
      .map(b=>({btn:b,sn:b.closest('.qlsp-order-finance').dataset.orderSn}));
  }
  let bulkBusy=false;
  async function runBulk(kind,fab){
    if(bulkBusy)return;
    const list=bulkTargets(kind);
    const what=kind==='confirm'?'XÁC NHẬN LẤY HÀNG':'CHẠY ĐƠN (in + nạp Wameli)';
    if(!list.length)return alert(kind==='confirm'?'Không có đơn Chưa xử lý nào trên trang.':'Không có đơn Đã xử lý nào trên trang.');
    if(!confirm(`${what} cho ${list.length} đơn?\n${list.map(x=>x.sn).join(', ')}`))return;
    bulkBusy=true;const label=fab.textContent;let ok=0,fail=[];
    for(let i=0;i<list.length;i++){
      fab.textContent=`${i+1}/${list.length}…`;
      if(list[i].btn)list[i].btn.textContent='Đang chạy…';
      const r=await runOne(list[i].sn,kind==='confirm');
      if(list[i].btn&&list[i].btn.isConnected)list[i].btn.textContent=r.ok?'✓ Xong':'✗ Lỗi';
      if(r.ok)ok++;else fail.push(`${list[i].sn}: ${r.text}`);
    }
    whMap=null;bulkBusy=false;fab.textContent=label;
    alert(`Xong: ${ok}/${list.length} đơn thành công.`+(fail.length?`\n\nLỗi:\n${fail.join('\n')}`:''));
  }
  function ensureFabs(){
    if(document.getElementById('qlsp-bulk'))return;
    const box=document.createElement('div');box.id='qlsp-bulk';
    box.innerHTML='<button type="button" data-k="confirm" title="Xác nhận lấy hàng các đơn Chưa xử lý (đã tích; không tích = tất cả trên trang)">✅ XN<br>hàng loạt</button><button type="button" data-k="run" title="Chạy (in + nạp Wameli) các đơn Đã xử lý (đã tích; không tích = tất cả trên trang)">⚡ Chạy<br>hàng loạt</button>';
    box.onclick=e=>{const b=e.target.closest('button[data-k]');if(b)runBulk(b.dataset.k,b);};
    document.body.appendChild(box);
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
    const heading=document.createElement('span');heading.className='qlsp-finance-heading';heading.textContent='';
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
      if(data.items?.length){
        const skuRow=document.createElement('div');skuRow.className='qlsp-finance-sku';
        const sn=panel.dataset.orderSn;
        [...new Set(data.items.map(it=>String(it.sku||'').trim()).filter(Boolean))].forEach(sku=>{
          const tag=document.createElement('span');tag.className='qlsp-finance-sku-item';
          const label=document.createElement('b');label.textContent='SKU: '+sku;
          // SKU gốc giữ nguyên + nút copy; ô riêng bên cạnh (mặc định = SKU) để sửa giá trị ghi vào cột S file Excel
          const copy0=document.createElement('button');copy0.type='button';copy0.textContent='C';copy0.title='Copy SKU';
          copy0.onclick=e=>{e.preventDefault();e.stopPropagation();navigator.clipboard.writeText(sku).then(()=>{copy0.textContent='✓';setTimeout(()=>copy0.textContent='C',1200);});};
          const lbl2=document.createElement('span');lbl2.className='qlsp-sku-lbl';lbl2.textContent='Cột S:';
          // Ô nhập: mặc định = SKU của đơn; sửa ở đây thì khi "Chạy đơn", cột S file Excel dùng giá trị này
          const inp=document.createElement('input');inp.className='qlsp-sku-input';inp.value=sku;inp.spellcheck=false;
          inp.title='SKU ghi vào cột S file Excel khi Chạy đơn (sửa được, Enter để lưu)';
          const save=()=>chrome.storage.local.get(SKU_OV,r=>{
            const all=r[SKU_OV]||{};const v=inp.value.trim();
            all[sn]={...(all[sn]||{})};
            if(!v||v===sku)delete all[sn][sku];else all[sn][sku]=v;
            if(!Object.keys(all[sn]).length)delete all[sn];
            chrome.storage.local.set({[SKU_OV]:all});
            inp.classList.toggle('qlsp-sku-edited',!!v&&v!==sku);
          });
          chrome.storage.local.get(SKU_OV,r=>{const v=(r[SKU_OV]||{})[sn]?.[sku];if(v){inp.value=v;inp.classList.add('qlsp-sku-edited');}});
          // Không để cú bấm / gõ trong ô lan ra thẻ đơn (Shopee mở trang chi tiết đơn)
          for(const ev of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','keyup','keypress'])
            inp.addEventListener(ev,e=>{e.stopPropagation();if(ev==='click'&&inp.closest('a'))e.preventDefault();});
          inp.addEventListener('change',save);
          inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){inp.blur();}});
          inp.addEventListener('input',()=>{inp.style.width=Math.min(520,Math.max(120,inp.value.length*7+16))+'px';});
          inp.style.width=Math.min(520,Math.max(120,sku.length*7+16))+'px';
          tag.append(label,copy0,lbl2,inp);skuRow.append(tag);
        });
        if(skuRow.childElementCount){body.append(skuRow);panel.parentElement?.setAttribute('data-qlsp-fin-sku','1');}
      }
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
    const fab=document.getElementById('qlsp-bulk');if(fab)fab.style.display=onList()?'':'none';
    if(!onList()){queue=[];document.querySelectorAll('.qlsp-order-finance').forEach(el=>el.remove());return;}
    ensureFabs();
    for(const sn of document.querySelectorAll('span.order-sn')){
      const text=(sn.textContent||'').match(/\b\d{6}[A-Z0-9]{6,24}\b/i)?.[0]?.toUpperCase();if(!text)continue;
      const card=findCard(sn);if(!card)continue;
      const link=card.querySelector('a[href*="/portal/sale/order/"]');
      const id=ids.get(text)||link?.getAttribute('href')?.match(/\/order\/(\d{5,20})(?:[/?#]|$)/)?.[1];
      let panel=card.querySelector('.qlsp-order-finance');
      if(panel&&(panel.dataset.orderSn!==text||panel.dataset.orderId!==(id||''))){panel.remove();panel=null;}
      if(panel){moveBadge(card,panel);if(panel.querySelector('.qlsp-finance-status')&&/^Chờ lấy hàng/.test(panel.querySelector('.qlsp-finance-status').textContent)&&!panel.querySelector('.qlsp-run'))addRunButtons(panel);continue;} // nhãn in tạo / điền sau khung: chuyển xuống
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
(()=>{const s=document.createElement('style');s.textContent='.qlsp-sku-lbl{color:#64748b;font-size:11px;margin-left:6px}.qlsp-sku-input{border:1px solid #fca5a5;border-radius:3px;padding:0 4px;font:600 12px/18px Arial,sans-serif;color:#dc2626;background:#fff}.qlsp-sku-input:focus{outline:2px solid #fb923c;border-color:#fb923c}.qlsp-sku-input.qlsp-sku-edited{background:#fef9c3;border-color:#eab308;color:#a16207}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-finance-title button.qlsp-run.qlsp-hcm{background:#2563eb!important;border-color:#1d4ed8!important}#qlsp-bulk{position:fixed;right:22px;bottom:300px;z-index:9999;display:flex;flex-direction:column;gap:8px}#qlsp-bulk button{width:56px;height:56px;border-radius:50%;border:none;color:#fff;font:700 10px/1.15 Arial,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)}#qlsp-bulk button[data-k=confirm]{background:#16a34a}#qlsp-bulk button[data-k=run]{background:#ea580c}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-finance-title button.qlsp-run{background:#16a34a;border-color:#15803d;color:#fff;font-weight:600}.qlsp-finance-title button.qlsp-run:disabled{opacity:.6;cursor:default}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-finance-sku{display:inline-flex;flex-wrap:wrap;gap:4px 10px;align-items:center}.qlsp-finance-sku-item{display:inline-flex;align-items:center;gap:4px;color:#dc2626;font-size:12px}.qlsp-finance-sku-item button{border:1px solid #cbd5e1;background:#fff;border-radius:3px;padding:0 6px;font-size:11px;line-height:16px;cursor:pointer;color:#1d4ed8}[data-qlsp-fin-sku] .shopee-qlsp-sku-display{display:none!important}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-finance-status{order:-1;background:#e0f2fe;color:#0369a1;font-weight:600;font-size:11px;padding:1px 7px;border-radius:10px;white-space:nowrap}.qlsp-order-finance .ud-ct-badge{order:8;font-size:11px!important;padding:1px 6px!important}';document.head.append(s);})();
(()=>{const s=document.createElement('style');s.textContent='.qlsp-fin-list .ud-ct-badge{visibility:hidden}.qlsp-fin-list .qlsp-order-finance .ud-ct-badge{visibility:visible}';document.head.append(s);try{document.documentElement.classList.toggle('qlsp-fin-list',location.pathname.split('/').filter(Boolean).join('/')==='portal/sale/order');}catch(e){}})();
