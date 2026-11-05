// Schema chung cho extension và web. Thứ tự cột theo nhóm; mdh luôn ở cột D, mvd ở cột E
// (một số chức năng cũ vẫn đọc DH!D:D). Các cột cũ bỏ hẳn: xem REMOVED_HEADERS.
export const RAW_HEADERS = Array.from({length:12},(_,i)=>`du_lieu_goc_${i+1}`);
export const HEADERS = [
  // Đơn
  'gian','shop_id','ngay_gio','mdh','mvd','order_id','trang_thai','mo_ta_trang_thai','ma_trang_thai',
  // Khách
  'ten_khach','nguoi_mua_id','ng_nhan','sdt','dia_chi',
  // Sản phẩm (mỗi dòng một sản phẩm)
  'item_id','model_id','ten_sp','phan_loai','anh','sku','sku_san_pham','slg','don_gia','thanh_tien','gia_sp','thanh_tien_sp',
  // Tiền
  'tong_tien','doanh_thu','phi_vc','vc_nguoi_mua','vc_tro_gia','phu_phi','phi_co_dinh','phi_dich_vu','phi_giao_dich','thue','thue_gtgt','thue_tncn','chi_tiet_phi','tong_thanh_tien_sp','loi_nhuan',
  // Vận chuyển & thời gian
  'don_vi_vc','hinh_thuc_vc','thanh_toan','han_giao','ghi_chu','ly_do_huy','ly_do_tra_hoan','ngay_hoan_thanh','ngay_huy',
  // Đồng bộ
  'chi_tiet_dong_bo','dong_bo_luc',...RAW_HEADERS,
  // Khóa dòng (gian|mdh|item_id-model_id|n) và dấu vân tay để biết dòng có đổi không
  'khoa','dau_van_tay'
];
// Cột của DH cũ: trống hoặc trùng với cột mới (ngay = ngay_gio, link_don tạo từ order_id).
export const REMOVED_HEADERS = ['ngay','ma_giam_gia','phi_khac','tien_sp','tinh_trang','id_sp','link_don','mvd_huy','mdh_huy'];
export const STATUS = ['Chờ thanh toán','Chờ xác nhận','Chờ lấy hàng','Đang giao','Đã giao','Hoàn thành','Đã hủy','Trả hàng','Hoàn tiền','Hoàn hàng','Trả hàng / Hoàn tiền','Khác'];
export const norm = s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export function statusOf(text) {
  const t=norm(text);
  if(/tra hang.*hoan tien|return.*refund/.test(t))return 'Trả hàng / Hoàn tiền';
  if(/hoan tien|refund/.test(t))return 'Hoàn tiền';
  if(/hoan hang|chuyen hoan|tra ve nguoi ban|return to sender/.test(t))return 'Hoàn hàng';
  if(/tra hang|return/.test(t))return 'Trả hàng';
  if(/huy|cancel/.test(t))return 'Đã hủy';
  if(/hoan thanh|completed/.test(t))return 'Hoàn thành';
  if(/dang giao|dang van chuyen|da giao cho|da ban giao|shipping|shipped/.test(t))return 'Đang giao';
  if(/da giao|giao thanh cong|giao hang thanh cong|da nhan|delivered/.test(t))return 'Đã giao';
  if(/cho lay|chuan bi|cho giao|ready.to.ship|to.ship/.test(t))return 'Chờ lấy hàng';
  if(/thanh toan|unpaid/.test(t))return 'Chờ thanh toán';
  if(/xac nhan|pending/.test(t))return 'Chờ xác nhận';
  return 'Khác';
}
export const terminal = s=>['Hoàn thành','Đã hủy','Hoàn tiền','Hoàn hàng'].includes(statusOf(s));
export function timestamp(value) {const n=Number(value);return n>0?new Date(n<1e12?n*1000:n).toISOString():'';}
// Giá SP = gia_ban DS_SP theo SKU phân loại (khớp đủ, rồi 10 ký tự đầu). prices: Map từ costMap.
function costOf(prices,sku){const k=String(sku||'').trim().toUpperCase();if(!prices||!k)return null;const v=prices.get(k)??prices.get(k.slice(0,10));return v==null?null:v;}
export function recordsForOrder(o,shop,code,findDeep,at=Date.now(),prices=null) {
  if(!o.orderSn || !shop.shopId || !code)throw new Error('Thiếu mã đơn hoặc mã gian/ID shop');
  const d=o.detail||{}, text=keys=>findDeep(d,keys,v=>typeof v==='string'&&v.trim())||'';
  const date=keys=>timestamp(findDeep(d,keys,v=>Number(v)>0));
  // byField có thể thiếu/null (đơn lưu từ bản cũ): lấy bù từ bảng chi tiết phí (rows)
  const f={...Object.fromEntries((o.income?.rows||[]).filter(r=>r.field&&r.amount!=null).map(r=>[r.field,r.amount])),
    ...Object.fromEntries(Object.entries(o.income?.byField||{}).filter(([,v])=>v!=null))};
  const hasIncome=!!o.income, detailOK=!!o.detail;
  const base={gian:code,mdh:o.orderSn,shop_id:String(shop.shopId),order_id:o.orderId,
    ngay_gio:date(['create_time','order_create_time','ctime'])||timestamp(o.createTime),
    mvd:o.tracking,tong_tien:o.total,trang_thai:statusOf(o.status),mo_ta_trang_thai:[o.status,o.statusNote].filter(Boolean).join(' · '),ma_trang_thai:o.statusCode,
    ten_khach:o.buyer,nguoi_mua_id:o.buyerId,don_vi_vc:o.shipping,hinh_thuc_vc:o.shippingType,thanh_toan:o.payment,han_giao:timestamp(o.shipBy),ghi_chu:o.note,
    chi_tiet_dong_bo:[detailOK?'Chi tiết: đã tải':`Chi tiết: ${o.detailError||'chưa tải'}`,hasIncome?'Doanh thu: đã tải':`Doanh thu: ${o.incomeError||'chưa có'}`].join(' · '),dong_bo_luc:new Date(at).toISOString()};
  if(detailOK)Object.assign(base,{ng_nhan:text(['recipient_name','name_of_recipient','receiver_name','buyer_address_name']),sdt:text(['recipient_phone','phone_number','buyer_address_phone','phone']),dia_chi:o.address,
    ly_do_huy:text(['cancel_reason','cancellation_reason','cancel_reason_description']),ly_do_tra_hoan:text(['return_reason','refund_reason','return_reason_description']),ngay_hoan_thanh:date(['complete_time','completed_time']),ngay_huy:date(['cancel_time','cancelled_time'])});
  if(hasIncome){
    const mapping={phu_phi:'FEES_AND_CHARGES',thue:'TAX_SUBTOTAL',doanh_thu:'ESCROW_AMOUNT',phi_vc:'ACTUAL_SHIPPING_FEE',phi_co_dinh:'COMMISSION_FEE',phi_dich_vu:'SERVICE_FEE',phi_giao_dich:'TRANSACTION_FEE',thue_gtgt:'VAT_WHT_AMOUNT',thue_tncn:'PIT_WHT_AMOUNT',vc_nguoi_mua:'SHIPPING_FEE_PAID_BY_BUYER',vc_tro_gia:'SHIPPING_REBATE_FROM_SHOPEE'};
    for(const [key,field]of Object.entries(mapping))if(f[field]!=null)base[key]=f[field];
    base.chi_tiet_phi=JSON.stringify(o.income.rows||[]);
  }
  // Tổng thành tiền SP & lợi nhuận: chỉ ghi khi mọi sản phẩm đều có giá trong DS_SP
  const costs=o.items.map(it=>{const p=costOf(prices,it.modelSku||it.itemSku);return p==null||!(Number(it.qty)>0)?null:p*Number(it.qty);});
  if(prices&&o.items.length&&costs.every(c=>c!=null)){
    base.tong_thanh_tien_sp=costs.reduce((a,b)=>a+b,0);
    if(hasIncome&&f.ESCROW_AMOUNT!=null)base.loi_nhuan=f.ESCROW_AMOUNT-base.tong_thanh_tien_sp;
  }
  // Chia JSON để không vượt giới hạn 50.000 ký tự/ô. Không cắt mất dữ liệu.
  const raw=JSON.stringify({card:o.raw,detail:o.detail||null,income:o.incomeRaw||null});
  if(raw.length>RAW_HEADERS.length*45000)throw new Error(`Dữ liệu đơn ${o.orderSn} vượt dung lượng lưu JSON`);
  return (o.items.length?o.items:[{}]).map((it,i)=>{
    const r={...base,ten_sp:it.name||'',phan_loai:it.model||'',anh:it.image||'',sku:it.modelSku||'',sku_san_pham:it.itemSku||'',item_id:String(it.itemId||''),model_id:String(it.modelId||''),slg:it.qty??'',don_gia:it.price??'',thanh_tien:it.price!=null&&it.qty!=null?it.price*it.qty:''};
    const p=costOf(prices,it.modelSku||it.itemSku);r.gia_sp=p??'';r.thanh_tien_sp=p!=null&&it.qty!=null?p*Number(it.qty):'';
    RAW_HEADERS.forEach((h,n)=>r[h]=i===0?raw.slice(n*45000,(n+1)*45000):'');
    return r;
  });
}
// Sắp lại sheet DH theo HEADERS: bỏ REMOVED_HEADERS, giữ cột lạ (đặt trước dữ liệu gốc), không mất ô nào.
export function migrateValues(values) {
  const old=(values[0]||[]).map(x=>String(x).trim());
  if(values.length>1&&!old.includes('mdh'))throw new Error('Sheet DH thiếu cột mdh');
  const extra=old.filter(h=>h&&!HEADERS.includes(h)&&!REMOVED_HEADERS.includes(h));
  const raw=HEADERS.indexOf(RAW_HEADERS[0]);
  const headers=[...HEADERS.slice(0,raw),...extra,...RAW_HEADERS,...HEADERS.slice(raw+RAW_HEADERS.length)];
  const dropped=REMOVED_HEADERS.filter(h=>old.includes(h)&&values.slice(1).some(r=>String(r[old.indexOf(h)]??'').trim()!==''&&!['ngay','link_don'].includes(h)));
  if(dropped.length)throw new Error(`Cột ${dropped.join(', ')} còn dữ liệu; không tự xóa`);
  const rows=values.slice(1).map(r=>headers.map(h=>{const i=old.indexOf(h);return i<0?'':(r[i]??'');}));
  return {headers,rows,removed:REMOVED_HEADERS.filter(h=>old.includes(h))};
}
// ---------- Ghi theo khóa (giống Hàng hoàn API): có thì ghi đè, chưa có thì thêm, không xóa dòng nào ----------
export const KEY_COLS=['gian','mdh','item_id','model_id','khoa','dau_van_tay'];
// FNV-1a 32 bit: đủ để phát hiện dòng thay đổi
function hash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');}
// Gắn khoa (n đếm khi một đơn có 2 dòng cùng phân loại) và dau_van_tay (bỏ qua giờ đồng bộ)
export function withKeys(rows){
  const count=new Map();
  return rows.map(r=>{
    const base=[r.gian,r.mdh,`${r.item_id||''}-${r.model_id||''}`].join('|'),n=(count.get(base)||0)+1;count.set(base,n);
    const out={...r,khoa:`${base}|${n}`};
    out.dau_van_tay=hash(JSON.stringify(HEADERS.filter(h=>!['dong_bo_luc','khoa','dau_van_tay'].includes(h)).map(h=>String(out[h]??''))));
    return out;
  });
}
// columns: {header: [giá trị từ dòng 2...]} của KEY_COLS (đọc riêng từng cột, không đọc dữ liệu gốc nặng)
// Trả về: updates [{row (0 = dòng tiêu đề), data}], appended, unchanged, rowCount
export function keyPlan(headersIn,columns,incoming){
  const headers=headersIn.map(x=>String(x).trim());
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error('Sheet DH có tiêu đề trùng');
  for(const h of HEADERS)if(!headers.includes(h))headers.push(h);
  const col=h=>columns[h]||[],n=Math.max(0,...KEY_COLS.map(h=>col(h).length));
  // Dòng cũ chưa có khoa: tính lại theo gian/mdh/item_id/model_id như lúc ghi
  const count=new Map(),byKey=new Map(),legacy=new Map();
  for(let i=0;i<n;i++){
    const gian=String(col('gian')[i]??''),mdh=String(col('mdh')[i]??'');
    let key=String(col('khoa')[i]??'');
    if(!key&&mdh){
      const it=String(col('item_id')[i]??''),base=[gian,mdh,`${it}-${col('model_id')[i]??''}`].join('|'),c=(count.get(base)||0)+1;count.set(base,c);key=`${base}|${c}`;
      // Dòng rất cũ không có item_id: ghép theo thứ tự với sản phẩm của cùng đơn
      if(!it){const g=gian+'|'+mdh;if(!legacy.has(g))legacy.set(g,[]);legacy.get(g).push(i+1);}
    }
    if(key&&!byKey.has(key))byKey.set(key,{row:i+1,fp:String(col('dau_van_tay')[i]??''),hasKey:!!col('khoa')[i]});
  }
  const updates=[],used=new Set();let next=n+1,appended=0,unchanged=0;
  for(const r of withKeys(incoming)){
    let hit=byKey.get(r.khoa);
    if(!hit){const q=legacy.get(r.gian+'|'+r.mdh);const row=q?.find(x=>!used.has(x));if(row)hit={row,fp:'',hasKey:false};}
    if(hit&&used.has(hit.row))hit=null;
    if(hit){
      used.add(hit.row);
      if(hit.hasKey&&hit.fp===r.dau_van_tay){unchanged++;continue;}
      // Không ghi ô rỗng đè dữ liệu cũ (Shopee lỗi tạm thời trả thiếu)
      const data=Object.fromEntries(Object.entries(r).filter(([,v])=>v!==''&&v!=null));
      // Chi tiết đơn lỗi lần này: giữ dữ liệu gốc cũ
      if(!String(r.chi_tiet_dong_bo).includes('Chi tiết: đã tải'))RAW_HEADERS.forEach(h=>delete data[h]);
      updates.push({row:hit.row,data});
    }else{updates.push({row:next++,data:r});appended++;}
  }
  return {headers,updates,appended,updated:updates.length-appended,unchanged,rowCount:Math.max(next,n+1)};
}
export function mergePlan(values,incoming) {
  const oldHeaders=(values[0]||[]).map(x=>String(x).trim());
  if(values.length>1&&(!oldHeaders.includes('mdh')||!oldHeaders.includes('gian')))throw new Error('Sheet DH thiếu cột mdh/gian; giữ nguyên dữ liệu, không ghi đè');
  if(new Set(oldHeaders.filter(Boolean)).size!==oldHeaders.filter(Boolean).length)throw new Error('Sheet DH có tiêu đề trùng');
  const headers=[...oldHeaders];for(const h of HEADERS)if(!headers.includes(h))headers.push(h);
  const objects=values.slice(1).map((row,i)=>({row:i+1,data:Object.fromEntries(oldHeaders.map((h,j)=>[h,row[j]??'']))}));
  const updates=[],used=new Set();let next=values.length||1;
  const groupKey=r=>JSON.stringify([norm(r.gian),String(r.mdh)]), groups=new Map();
  for(const r of incoming){const k=groupKey(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  for(const rows of groups.values()){
    const sample=rows[0], candidates=objects.filter(x=>groupKey(x.data)===groupKey(sample)&&(!x.data.shop_id||String(x.data.shop_id)===String(sample.shop_id)));
    for(const r of rows){
      const match=candidates.find(x=>!used.has(x.row)&&r.item_id&&String(x.data.item_id)===r.item_id&&String(x.data.model_id)===r.model_id)
        ||candidates.find(x=>!used.has(x.row)&&r.sku&&x.data.sku===r.sku)
        ||candidates.find(x=>!used.has(x.row));
      const row=match?match.row:next++;used.add(row);
      // Chỉ cập nhật các cột lấy từ Shopee, giữ cột người dùng tự thêm.
      const data={...r};
      if(match){
        for(const h of ['sku','ten_sp','phan_loai','anh','mvd','item_id','model_id','sku_san_pham'])if(data[h]===''&&match.data[h])delete data[h];
        if(match.data.dong_bo_luc&&String(r.chi_tiet_dong_bo).includes('Chi tiết:')&&!String(r.chi_tiet_dong_bo).includes('Chi tiết: đã tải'))RAW_HEADERS.forEach(h=>delete data[h]);
      }
      updates.push({row,data});
    }
    for(const stale of candidates)if(!used.has(stale.row))updates.push({row:stale.row,clear:true});
  }
  return {headers,updates,rowCount:Math.max(next,values.length,1)};
}
export function parseSheet(values) {
  const headers=values[0]||[],groups=new Map();
  if(values.length&&!headers.includes('mdh'))throw new Error('Sheet DH thiếu cột mdh');
  for(const [index,cells] of values.slice(1).entries()){
    const r=Object.fromEntries(headers.map((h,i)=>[h,cells[i]??'']));if(!r.mdh)continue;
    const key=JSON.stringify([r.shop_id||norm(r.gian),r.mdh]);
    if(!groups.has(key))groups.set(key,{...r,key,sheetRow:index+2,items:[],status:statusOf(r.trang_thai),raw:''});
    const o=groups.get(key);o.items.push(r);
    if(!o.raw)o.raw=RAW_HEADERS.map(h=>r[h]||'').join('');
  }
  return [...groups.values()];
}
