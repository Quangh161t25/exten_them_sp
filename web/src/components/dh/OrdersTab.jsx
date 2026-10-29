import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {fetchDhSheet,fetchDhRaw} from '../../services/dhSheet.js';
import {STATUS,norm} from '../../../../shared/dh-sheet.js';
import {parseMoney} from '../../utils/formatters.js';
import {ArrowLeft,ArrowUpDown,Calendar,ChevronDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,Columns3,Download,Eye,Home,RefreshCw,Search,Store,X} from 'lucide-react';
import './orders.css';

const money=v=>v===''||v==null?'—':`${parseMoney(v).toLocaleString('vi-VN')} ₫`;
const display=v=>v===''||v==null?'—':String(v);
function dateValue(o){
  const s=String(o.ngay_gio||o.ngay||'');
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():Date.parse(s)||0;
}
const stamp=v=>v?new Date(v).toLocaleString('vi-VN'):'Chưa có';
const tone=s=>/Hoàn thành|Đã giao/.test(s)?'green':/hủy/.test(s)?'red':/Trả|Hoàn tiền|Hoàn hàng/.test(s)?'purple':s==='Đang giao'?'blue':'orange';
function Badge({order}){return <span className={`dh-badge ${tone(order.status)}`}>{order.status==='Khác'?order.trang_thai||'Chưa rõ trạng thái':order.status}</span>;}
const imageUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
function Product({item}){return <div className="dh-product">{imageUrl(item.anh)?<img loading="lazy" src={item.anh} alt=""/>:<span className="dh-image-placeholder">SP</span>}<div><strong>{item.ten_sp||item.id_sp||'Chưa có tên sản phẩm'}</strong><small>{item.phan_loai||'Không có phân loại'} · SL: {display(item.slg)}</small><code>{item.sku||'Chưa có SKU phân loại'}</code></div></div>;}
function Detail({order,headers,onClose}){
  const [raw,setRaw]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const closeRef=useRef(null);
  useEffect(()=>{const previous=document.activeElement;closeRef.current?.focus();const escape=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);previous?.focus();};},[onClose]);
  const fields=(pairs)=><dl>{pairs.map(([label,key])=><React.Fragment key={key}><dt>{label}</dt><dd>{display(order[key])}</dd></React.Fragment>)}</dl>;
  return <div className="dh-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="dh-detail" role="dialog" aria-modal="true" aria-label={`Chi tiết đơn ${order.mdh}`}>
    <header><div><small>GIAN {order.gian}</small><h2>{order.mdh}</h2><Badge order={order}/></div><button ref={closeRef} onClick={onClose} aria-label="Đóng chi tiết">✕ Đóng</button></header>
    <div className="dh-detail-body">
      <p className="dh-muted">{order.mo_ta_trang_thai||order.trang_thai} · Cập nhật: {stamp(order.dong_bo_luc)}</p>
      {order.chi_tiet_dong_bo&&<p className="dh-note">{order.chi_tiet_dong_bo}</p>}
      <h3>Sản phẩm ({order.items.length})</h3><div className="dh-scroll"><table><thead><tr><th>Sản phẩm / SKU phân loại</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((it,i)=><tr key={i}><td><Product item={it}/></td><td>{money(it.don_gia)}</td><td>{money(it.thanh_tien)}</td></tr>)}</tbody></table></div>
      <div className="dh-detail-grid"><section><h3>Khách hàng & giao nhận</h3>{fields([['Người mua','ten_khach'],['Người nhận','ng_nhan'],['Số điện thoại','sdt'],['Địa chỉ','dia_chi'],['Vận đơn','mvd'],['Đơn vị vận chuyển','don_vi_vc'],['Hình thức vận chuyển','hinh_thuc_vc'],['Hạn giao','han_giao'],['Ghi chú','ghi_chu']])}</section>
      <section><h3>Trạng thái & thời gian</h3>{fields([['Ngày đặt','ngay_gio'],['Trạng thái Shopee','mo_ta_trang_thai'],['Hoàn thành lúc','ngay_hoan_thanh'],['Hủy lúc','ngay_huy'],['Lý do hủy','ly_do_huy'],['Lý do trả / hoàn','ly_do_tra_hoan'],['Mã trạng thái gốc','ma_trang_thai'],['Tình trạng nội bộ','tinh_trang']])}</section></div>
      <h3>Thanh toán & các khoản phí</h3><div className="dh-finances">{[['Tổng thanh toán','tong_tien'],['Doanh thu Shopee','doanh_thu'],['Phí vận chuyển','phi_vc'],['Tổng phụ phí','phu_phi'],['Tổng thuế','thue'],['Phí cố định','phi_co_dinh'],['Phí dịch vụ','phi_dich_vu'],['Phí giao dịch','phi_giao_dich'],['Thuế GTGT','thue_gtgt'],['Thuế TNCN','thue_tncn'],['Giá vốn đã lưu','tien_sp'],['Lợi nhuận đã lưu','loi_nhuan']].map(([label,key])=><div key={key}><small>{label}</small><b>{money(order[key])}</b></div>)}</div>
      <p className="dh-muted">Doanh thu theo dữ liệu Shopee trả về, có thể còn là ước tính. Ô chưa có dữ liệu hiển thị “—”.</p>
      {order.chi_tiet_phi&&<details><summary>Chi tiết khoản phí từ Shopee</summary><FeeDetails value={order.chi_tiet_phi}/></details>}
      <div className="dh-actions">{order.order_id&&<a href={`https://banhang.shopee.vn/portal/sale/order/${encodeURIComponent(order.order_id)}`} target="_blank" rel="noreferrer">Mở đơn trên Shopee ↗</a>}
        <button disabled={loading} onClick={async()=>{setLoading(true);setError('');try{const result=await fetchDhRaw(order,headers);setRaw(result);if(!result)setError('Đơn cũ chưa có dữ liệu gốc. Chờ extension đồng bộ lại.');}catch(e){setError(e.message);}finally{setLoading(false);}}}>{loading?'Đang tải…':'Xem toàn bộ dữ liệu gốc'}</button></div>
      {error&&<p role="alert" className="dh-error">{error}</p>}{raw&&<pre className="dh-raw">{JSON.stringify(raw,null,2)}</pre>}
    </div>
  </section></div>;
}
function FeeDetails({value}){try{const rows=JSON.parse(value);return <dl>{rows.map((r,i)=><React.Fragment key={i}><dt style={{paddingLeft:(r.level||0)*12}}>{r.name}</dt><dd>{money(r.amount)}</dd></React.Fragment>)}</dl>;}catch{return <pre>{value}</pre>;}}
function exportCsv(rows){
  const keys=['gian','mdh','ngay_gio','trang_thai','ten_khach','ng_nhan','sdt','dia_chi','mvd','don_vi_vc','ten_sp','phan_loai','sku','slg','don_gia','thanh_tien','tong_tien','doanh_thu','phu_phi','thue','dong_bo_luc'];
  const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const csv=[keys,...rows.flatMap(o=>o.items.map((it,i)=>keys.map(k=>i>0&&['tong_tien','doanh_thu','phu_phi','thue'].includes(k)?'':it[k])))].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='DH.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const COLUMNS=[['order','Đơn hàng'],['product','Sản phẩm'],['customer','Khách hàng'],['status','Trạng thái'],['shipping','Vận chuyển'],['date','Ngày đặt'],['payment','Thanh toán']];
const COL_KEY='dh.hiddenColumns';
const SORTS=[['new','Mới nhất'],['old','Cũ nhất'],['money','Tổng tiền cao nhất']];
const fmtDate=v=>v?new Date(v).toLocaleDateString('vi-VN'):'—';
// Ô lọc dạng nút + danh sách thả xuống (đóng khi bấm ra ngoài hoặc Esc).
function Dropdown({icon:Icon,label,active,children,align='left'}){
  const [open,setOpen]=useState(false),ref=useRef(null);
  useEffect(()=>{if(!open)return;const out=e=>{if(!ref.current?.contains(e.target))setOpen(false);};const esc=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('mousedown',out);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('mousedown',out);document.removeEventListener('keydown',esc);};},[open]);
  return <div className="dh-dd" ref={ref}><button type="button" className={`dh-dd-btn${active?' on':''}`} aria-expanded={open} onClick={()=>setOpen(!open)}><Icon size={14}/><span>{label}</span><ChevronDown size={14}/></button>{open&&<div className={`dh-dd-menu ${align}`} onClick={e=>{if(e.target.closest('[data-close]'))setOpen(false);}}>{children}</div>}</div>;
}
const Option=({on,onClick,children})=><button type="button" data-close className={`dh-dd-opt${on?' on':''}`} onClick={onClick}>{children}{on&&<span>✓</span>}</button>;
export default function OrdersTab(){
  const [data,setData]=useState({orders:[],headers:[]}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(0);
  const [search,setSearch]=useState(''),[shop,setShop]=useState(''),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[sort,setSort]=useState('new'),[page,setPage]=useState(1),[size,setSize]=useState(20),[selected,setSelected]=useState(null),[checked,setChecked]=useState(new Set());
  const [hidden,setHidden]=useState(()=>{try{return new Set(JSON.parse(localStorage.getItem(COL_KEY)||'[]'));}catch{return new Set();}});
  const busy=useRef(false),mounted=useRef(false);
  const refresh=useCallback(async()=>{if(busy.current)return;busy.current=true;setLoading(true);try{const next=await fetchDhSheet();if(mounted.current){setData(next);setError('');setLoaded(Date.now());}}catch(e){if(mounted.current)setError(e.message);}finally{busy.current=false;if(mounted.current)setLoading(false);}},[]);
  useEffect(()=>{mounted.current=true;refresh();const timer=setInterval(refresh,60000);return()=>{mounted.current=false;clearInterval(timer);};},[refresh]);
  useEffect(()=>{setPage(1);setChecked(new Set());},[search,shop,status,from,to,sort,size]);
  const toggleColumn=k=>setHidden(h=>{const n=new Set(h);n.has(k)?n.delete(k):n.add(k);try{localStorage.setItem(COL_KEY,JSON.stringify([...n]));}catch{/* bỏ qua */}return n;});
  const shops=useMemo(()=>[...new Set(data.orders.map(o=>o.gian).filter(Boolean))].sort(),[data]);
  const base=useMemo(()=>data.orders.filter(o=>{
    const t=dateValue(o),q=norm(search);return (!shop||o.gian===shop)&&(!from||t>=new Date(from+'T00:00:00').getTime())&&(!to||t<=new Date(to+'T23:59:59').getTime())&&(!q||norm([o.mdh,o.mvd,o.ten_khach,o.ng_nhan,...o.items.flatMap(i=>[i.ten_sp,i.phan_loai,i.sku])].join(' ')).includes(q));
  }),[data,search,shop,from,to]);
  const counts=useMemo(()=>Object.fromEntries(STATUS.map(s=>[s,base.filter(o=>o.status===s).length])),[base]);
  const rows=useMemo(()=>base.filter(o=>!status||o.status===status).sort((a,b)=>sort==='money'?parseMoney(b.tong_tien)-parseMoney(a.tong_tien):sort==='old'?dateValue(a)-dateValue(b):dateValue(b)-dateValue(a)),[base,status,sort]);
  const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages),start=(current-1)*size,visible=rows.slice(start,start+size);
  const at=data.orders.reduce((m,o)=>Math.max(m,Date.parse(o.dong_bo_luc)||0),0);
  const close=useCallback(()=>setSelected(null),[]);
  const show=k=>!hidden.has(k), cols=COLUMNS.filter(([k])=>show(k));
  const allOnPage=visible.length>0&&visible.every(o=>checked.has(o.key));
  const pick=key=>setChecked(c=>{const n=new Set(c);n.has(key)?n.delete(key):n.add(key);return n;});
  const exportRows=checked.size?rows.filter(o=>checked.has(o.key)):rows;
  const filtered=!!(shop||from||to||sort!=='new'||search);
  const tabs=[['',base.length],...STATUS.filter(s=>counts[s]||s===status||['Chờ lấy hàng','Đang giao','Đã giao','Hoàn thành','Đã hủy','Trả hàng','Hoàn tiền'].includes(s)).map(s=>[s,counts[s]])];
  const total=rows.reduce((s,o)=>s+parseMoney(o.tong_tien),0);
  const cells={
    order:o=><><span className="dh-shop">{o.gian||'—'}</span><button className="dh-order-link" onClick={()=>setSelected(o)}>{o.mdh}</button></>,
    product:o=><><Product item={o.items[0]}/>{o.items.length>1&&<button className="dh-more" onClick={()=>setSelected(o)}>+ {o.items.length-1} sản phẩm khác</button>}</>,
    customer:o=><><div className="dh-clip">{o.ten_khach||'—'}</div><small className="dh-clip">{o.ng_nhan}</small></>,
    status:o=><><Badge order={o}/><small className="dh-status-note" title={o.mo_ta_trang_thai}>{o.mo_ta_trang_thai}</small></>,
    shipping:o=><><div className="dh-clip">{o.don_vi_vc||'—'}</div><small className="dh-mono">{o.mvd||'Chưa có vận đơn'}</small></>,
    date:o=>fmtDate(dateValue(o)),
    payment:o=><><b>{money(o.tong_tien)}</b><small>DT: {money(o.doanh_thu)}</small></>
  };
  return <div className="dh-page">
    <header className="dh-crumbs"><nav aria-label="Đường dẫn"><Home size={14}/><span>Trang chủ</span><ChevronRight size={13}/><span>Bán hàng</span><ChevronRight size={13}/><b>Đơn hàng</b></nav><span className="dh-sync">{loading?'Đang đồng bộ…':`Cập nhật: ${at?stamp(at):'chưa có dữ liệu'}`}</span></header>
    <nav className="dh-tabs" aria-label="Trạng thái đơn">{tabs.map(([s,n])=><button key={s||'all'} aria-pressed={status===s} className={status===s?'active':''} onClick={()=>setStatus(s)}>{s||'Tất cả'}<span>{n}</span></button>)}</nav>
    <div className="dh-card">
      <div className="dh-toolbar">
        {filtered&&<button className="dh-ghost" onClick={()=>{setSearch('');setShop('');setFrom('');setTo('');setSort('new');}}><ArrowLeft size={14}/>Bỏ lọc</button>}
        <label className="dh-search"><Search size={15}/><input aria-label="Tìm đơn hàng" placeholder="Tìm mã đơn, vận đơn, khách, sản phẩm, SKU…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Xoá tìm kiếm" onClick={()=>setSearch('')}><X size={13}/></button>}</label>
        <div className="dh-grow"/>
        <Dropdown icon={Columns3} label="Tùy chỉnh cột" align="right">{COLUMNS.map(([k,l])=><label key={k} className="dh-dd-check"><input type="checkbox" checked={show(k)} disabled={k==='order'} onChange={()=>toggleColumn(k)}/>{l}</label>)}</Dropdown>
        <button className="dh-ghost" onClick={()=>exportCsv(exportRows)} disabled={!exportRows.length}><Download size={14}/>{checked.size?`Xuất ${checked.size} đơn`:'Xuất CSV'}</button>
        <button className="dh-primary" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading?'dh-spin':''}/>Làm mới</button>
      </div>
      <div className="dh-filterbar">
        <Dropdown icon={Store} label={shop?`Gian: ${shop}`:'Gian'} active={!!shop}><Option on={!shop} onClick={()=>setShop('')}>Tất cả gian</Option>{shops.map(s=><Option key={s} on={shop===s} onClick={()=>setShop(s)}>{s}</Option>)}</Dropdown>
        <Dropdown icon={Calendar} label={from||to?`${from?fmtDate(from+'T00:00'):'…'} → ${to?fmtDate(to+'T00:00'):'…'}`:'Ngày đặt'} active={!!(from||to)}>
          <div className="dh-dd-dates"><label>Từ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
          <div className="dh-dd-quick">{[['Hôm nay',0],['7 ngày',6],['30 ngày',29]].map(([l,d])=><button key={l} type="button" data-close onClick={()=>{const iso=x=>x.toLocaleDateString('sv-SE');setFrom(iso(new Date(Date.now()-d*86400000)));setTo(iso(new Date()));}}>{l}</button>)}<button type="button" data-close onClick={()=>{setFrom('');setTo('');}}>Bỏ chọn</button></div></div>
        </Dropdown>
        <Dropdown icon={ArrowUpDown} label={SORTS.find(s=>s[0]===sort)[1]} active={sort!=='new'}>{SORTS.map(([v,l])=><Option key={v} on={sort===v} onClick={()=>setSort(v)}>{l}</Option>)}</Dropdown>
        <span className="dh-grow"/>
        <span className="dh-sum">{rows.length} đơn · Tổng thanh toán <b>{money(total)}</b></span>
      </div>
      {error&&<div role="alert" className="dh-error">{error}. Dữ liệu đã tải trước đó được giữ lại.</div>}
      <div className="dh-scroll dh-list"><table><thead><tr><th className="dh-check"><input type="checkbox" aria-label="Chọn tất cả trên trang" checked={allOnPage} onChange={()=>setChecked(c=>{const n=new Set(c);visible.forEach(o=>allOnPage?n.delete(o.key):n.add(o.key));return n;})}/></th>{cols.map(([k,l])=><th key={k} className={`c-${k}`}>{l}</th>)}<th className="dh-act">Thao tác</th></tr></thead>
        <tbody>{visible.map(o=><tr key={o.key} className={checked.has(o.key)?'sel':''}><td className="dh-check"><input type="checkbox" aria-label={`Chọn đơn ${o.mdh}`} checked={checked.has(o.key)} onChange={()=>pick(o.key)}/></td>{cols.map(([k])=><td key={k} className={`c-${k}`}>{cells[k](o)}</td>)}<td className="dh-act"><button className="dh-icon" title="Xem chi tiết" aria-label={`Xem chi tiết đơn ${o.mdh}`} onClick={()=>setSelected(o)}><Eye size={16}/></button></td></tr>)}
        {!visible.length&&<tr><td colSpan={cols.length+2} className="dh-empty">{loading?'Đang đọc dữ liệu DH…':loaded?'Không có đơn phù hợp. Để tải lịch sử, mở extension → Đơn Shopee → Đồng bộ DH ngay.':'Chưa tải được dữ liệu.'}</td></tr>}</tbody></table></div>
      <footer className="dh-footer"><div className="dh-pagesize"><span>{rows.length?`${start+1}–${start+visible.length}`:'0'}/<i>Tổng:</i>{rows.length}</span><select aria-label="Số dòng mỗi trang" value={size} onChange={e=>setSize(Number(e.target.value))}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select><i>/ trang</i></div>
        <div className="dh-pager"><button aria-label="Trang đầu" disabled={current<=1} onClick={()=>setPage(1)}><ChevronsLeft size={14}/></button><button aria-label="Trang trước" disabled={current<=1} onClick={()=>setPage(current-1)}><ChevronLeft size={14}/></button><b>{current}</b><span>/{pages}</span><button aria-label="Trang sau" disabled={current>=pages} onClick={()=>setPage(current+1)}><ChevronRight size={14}/></button><button aria-label="Trang cuối" disabled={current>=pages} onClick={()=>setPage(pages)}><ChevronsRight size={14}/></button></div></footer>
    </div>
    {selected&&<Detail key={selected.key} order={selected} headers={data.headers} onClose={close}/>}
  </div>;
}
