// Schema chung cho extension và web. Giữ 27 cột DH cũ, chỉ nối thêm cột.
export const LEGACY_HEADERS = ['gian','ngay','ngay_gio','mdh','mvd','tong_tien','ma_giam_gia','phi_vc','phu_phi','thue','doanh_thu','phi_khac','tien_sp','loi_nhuan','tinh_trang','trang_thai','sku','id_sp','slg','don_gia','thanh_tien','ten_khach','ng_nhan','dia_chi','link_don','mvd_huy','mdh_huy'];
export const RAW_HEADERS = Array.from({length:12},(_,i)=>`du_lieu_goc_${i+1}`);
export const HEADERS = [...LEGACY_HEADERS,'shop_id','order_id','item_id','model_id','ten_sp','phan_loai','anh','sku_san_pham','nguoi_mua_id','sdt','don_vi_vc','hinh_thuc_vc','thanh_toan','han_giao','ghi_chu','mo_ta_trang_thai','ma_trang_thai','ly_do_huy','ly_do_tra_hoan','ngay_hoan_thanh','ngay_huy','phi_co_dinh','phi_dich_vu','phi_giao_dich','thue_gtgt','thue_tncn','vc_nguoi_mua','vc_tro_gia','chi_tiet_phi','chi_tiet_dong_bo','dong_bo_luc',...RAW_HEADERS];
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
export function recordsForOrder(o,shop,code,findDeep,at=Date.now()) {
  if(!o.orderSn || !shop.shopId || !code)throw new Error('Thiếu mã đơn hoặc mã gian/ID shop');
  const d=o.detail||{}, text=keys=>findDeep(d,keys,v=>typeof v==='string'&&v.trim())||'';
  const date=keys=>timestamp(findDeep(d,keys,v=>Number(v)>0));
  const f=o.income?.byField||{}, hasIncome=!!o.income, detailOK=!!o.detail;
  const base={gian:code,mdh:o.orderSn,shop_id:String(shop.shopId),order_id:o.orderId,ngay:o.orderDate,
    ngay_gio:date(['create_time','order_create_time','ctime'])||timestamp(o.createTime),
    mvd:o.tracking,tong_tien:o.total,trang_thai:statusOf(o.status),mo_ta_trang_thai:[o.status,o.statusNote].filter(Boolean).join(' · '),ma_trang_thai:o.statusCode,
    ten_khach:o.buyer,nguoi_mua_id:o.buyerId,don_vi_vc:o.shipping,hinh_thuc_vc:o.shippingType,thanh_toan:o.payment,han_giao:timestamp(o.shipBy),ghi_chu:o.note,
    link_don:`https://banhang.shopee.vn/portal/sale/order/${encodeURIComponent(o.orderId)}`,
    chi_tiet_dong_bo:[detailOK?'Chi tiết: đã tải':`Chi tiết: ${o.detailError||'chưa tải'}`,hasIncome?'Doanh thu: đã tải':`Doanh thu: ${o.incomeError||'chưa có'}`].join(' · '),dong_bo_luc:new Date(at).toISOString()};
  if(detailOK)Object.assign(base,{ng_nhan:text(['recipient_name','name_of_recipient','receiver_name','buyer_address_name']),sdt:text(['recipient_phone','phone_number','buyer_address_phone','phone']),dia_chi:o.address,
    ly_do_huy:text(['cancel_reason','cancellation_reason','cancel_reason_description']),ly_do_tra_hoan:text(['return_reason','refund_reason','return_reason_description']),ngay_hoan_thanh:date(['complete_time','completed_time']),ngay_huy:date(['cancel_time','cancelled_time'])});
  if(hasIncome){
    const mapping={phu_phi:'FEES_AND_CHARGES',thue:'TAX_SUBTOTAL',doanh_thu:'ESCROW_AMOUNT',phi_vc:'ACTUAL_SHIPPING_FEE',phi_co_dinh:'COMMISSION_FEE',phi_dich_vu:'SERVICE_FEE',phi_giao_dich:'TRANSACTION_FEE',thue_gtgt:'VAT_WHT_AMOUNT',thue_tncn:'PIT_WHT_AMOUNT',vc_nguoi_mua:'SHIPPING_FEE_PAID_BY_BUYER',vc_tro_gia:'SHIPPING_REBATE_FROM_SHOPEE'};
    for(const [key,field]of Object.entries(mapping))if(f[field]!=null)base[key]=f[field];
    base.chi_tiet_phi=JSON.stringify(o.income.rows||[]);
  }
  // Chia JSON để không vượt giới hạn 50.000 ký tự/ô. Không cắt mất dữ liệu.
  const raw=JSON.stringify({card:o.raw,detail:o.detail||null,income:o.incomeRaw||null});
  if(raw.length>RAW_HEADERS.length*45000)throw new Error(`Dữ liệu đơn ${o.orderSn} vượt dung lượng lưu JSON`);
  return (o.items.length?o.items:[{}]).map((it,i)=>{
    const r={...base,ten_sp:it.name||'',phan_loai:it.model||'',anh:it.image||'',sku:it.modelSku||'',sku_san_pham:it.itemSku||'',item_id:String(it.itemId||''),model_id:String(it.modelId||''),slg:it.qty??'',don_gia:it.price??'',thanh_tien:it.price!=null&&it.qty!=null?it.price*it.qty:''};
    RAW_HEADERS.forEach((h,n)=>r[h]=i===0?raw.slice(n*45000,(n+1)*45000):'');
    return r;
  });
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
      // Chỉ cập nhật các cột lấy từ Shopee, giữ giá vốn/lợi nhuận/ghi chú thủ công và cột lạ.
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
