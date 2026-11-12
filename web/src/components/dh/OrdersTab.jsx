import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {fetchDhSheet,fetchDhRaw,updateDhOrder} from '../../services/dhSheet.js';
import {STATUS,norm,HEADERS,RAW_HEADERS,matchSearchQuery} from '../../../../shared/dh-sheet.js';
import {parseMoney, formatMoneyVND} from '../../utils/formatters.js';
import {ArrowLeft,ArrowUpDown,Calendar,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,Columns3,Download,Eye,Home,RefreshCw,Search,Store,X,Edit3,Save,CheckCircle2} from 'lucide-react';
import {Dropdown,Option} from '../common/PageShell.jsx';
import DateRangePicker from '../common/DateRangePicker.jsx';
import './orders.css';

const money=v=>v===''||v==null?'—':`${parseMoney(v).toLocaleString('vi-VN')} ₫`;
const display=v=>v===''||v==null?'—':String(v);
function dateValue(o){
  const s=String(o.ngay_gio||'');
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():Date.parse(s)||0;
}
const stamp=v=>v?new Date(v).toLocaleString('vi-VN'):'Chưa có';
const tone=s=>/Hoàn thành|Đã giao/.test(s)?'green':/hủy/.test(s)?'red':/Trả|Hoàn tiền|Hoàn hàng/.test(s)?'purple':s==='Đang giao'?'blue':'orange';
function Badge({order}){return <span className={`dh-badge ${tone(order.status)}`}>{order.status==='Khác'?order.trang_thai||'Chưa rõ trạng thái':order.status}</span>;}
const imageUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
function Product({item}){return <div className="dh-product">{imageUrl(item.anh)?<img loading="lazy" src={item.anh} alt=""/>:<span className="dh-image-placeholder">SP</span>}<div><strong>{item.ten_sp||'Chưa có tên sản phẩm'}</strong><small>{item.phan_loai||'Không có phân loại'} · SL: {display(item.slg)}</small><code>{item.sku||'Chưa có SKU phân loại'}</code></div></div>;}
const STATUS_PRESETS = [
  'ĐỦ HÀNG - ĐẠT CHUẨN',
  'THIẾU HÀNG',
  'HÀNG HỎNG / VỠ',
  'SAI MẪU - CHỜ ĐỔI',
  'ĐÃ BÙ TIỀN',
  'GIAO THÀNH CÔNG',
  'KHÁCH TỪ CHỐI NHẬN',
  'CHỜ ĐỐI SOÁT'
];

function Detail({order,headers,onUpdateOrder,onClose}){
  const [raw,setRaw]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [isEditing,setIsEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [saveSuccess,setSaveSuccess]=useState('');

  const [giaThucTe,setGiaThucTe]=useState(order.gia_thuc_te??'');
  const [tinhTrangThucTe,setTinhTrangThucTe]=useState(order.tinh_trang_thuc_te??'');
  const [xacNhanCongNo,setXacNhanCongNo]=useState(order.xac_nhan_cong_no||'CHỜ TÍNH');
  const [ghiChu,setGhiChu]=useState(order.ghi_chu??'');
  const [mvd,setMvd]=useState(order.mvd??'');

  const closeRef=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    closeRef.current?.focus();
    const escape=e=>{if(e.key==='Escape'&&!isEditing)onClose();};
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('keydown',escape);previous?.focus();};
  },[onClose,isEditing]);

  const resetForm=()=>{
    setGiaThucTe(order.gia_thuc_te??'');
    setTinhTrangThucTe(order.tinh_trang_thuc_te??'');
    setXacNhanCongNo(order.xac_nhan_cong_no||'CHỜ TÍNH');
    setGhiChu(order.ghi_chu??'');
    setMvd(order.mvd??'');
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSave=async()=>{
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try{
      const updates={
        gia_thuc_te:giaThucTe,
        tinh_trang_thuc_te:tinhTrangThucTe,
        xac_nhan_cong_no:xacNhanCongNo,
        ghi_chu:ghiChu,
        mvd:mvd
      };
      await updateDhOrder(order,updates,headers);
      const updatedOrder={
        ...order,
        ...updates,
        items:(order.items||[]).map(it=>({...it,...updates}))
      };
      if(onUpdateOrder)onUpdateOrder(updatedOrder);
      setSaveSuccess('Đã lưu thành công vào sheet DH!');
      setTimeout(()=>{
        setIsEditing(false);
        setSaveSuccess('');
      },1000);
    }catch(err){
      setSaveError(err.message||'Lỗi khi lưu vào Google Sheets');
    }finally{
      setSaving(false);
    }
  };

  const fields=(pairs)=><dl>{pairs.map(([label,key])=><React.Fragment key={key}><dt>{label}</dt><dd>{display(order[key])}</dd></React.Fragment>)}</dl>;

  return <div className="dh-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="dh-detail" role="dialog" aria-modal="true" aria-label={`Chi tiết đơn ${order.mdh}`}>
    <header>
      <div><small>GIAN {order.gian}</small><h2>{order.mdh}</h2><Badge order={order}/></div>
      <div className="dh-detail-header-actions">
        {!isEditing?(
          <button type="button" className="dh-btn-edit" onClick={()=>{setIsEditing(true);setSaveError('');setSaveSuccess('');}} title="Chỉnh sửa thông tin đơn hàng & đối soát thực tế">
            <Edit3 size={14}/> Sửa
          </button>
        ):(
          <>
            <button type="button" className="dh-btn-save" disabled={saving} onClick={handleSave} title="Lưu thay đổi vào Google Sheets">
              <Save size={14}/> {saving?'Đang lưu…':'Lưu'}
            </button>
            <button type="button" className="dh-btn-cancel" disabled={saving} onClick={()=>{setIsEditing(false);resetForm();}}>
              Hủy
            </button>
          </>
        )}
        <button ref={closeRef} onClick={onClose} aria-label="Đóng chi tiết">✕ Đóng</button>
      </div>
    </header>
    <div className="dh-detail-body">
      <p className="dh-muted">{order.mo_ta_trang_thai||order.trang_thai} · Cập nhật: {stamp(order.dong_bo_luc)}</p>
      {order.chi_tiet_dong_bo&&<p className="dh-note">{order.chi_tiet_dong_bo}</p>}

      <div className={`dh-reconciliation-card ${isEditing?'is-editing':''}`}>
        <div className="dh-reconciliation-header">
          <h4>
            <CheckCircle2 size={16} color={isEditing?'#2563eb':'#16a34a'}/>
            {isEditing?'Chỉnh sửa thông tin đơn & Đối soát thực tế':'Thông tin điều chỉnh & Đối soát'}
          </h4>
          {!isEditing?(
            <button type="button" className="dh-link-btn" onClick={()=>setIsEditing(true)}>
              <Edit3 size={13}/> Sửa thông tin này
            </button>
          ):(
            <span className="dh-editing-tag">Đang mở chế độ sửa</span>
          )}
        </div>

        {!isEditing?(
          <div className="dh-reconciliation-grid">
            <div className="dh-recon-item">
              <span className="dh-recon-label">Giá thực tế (tính lại tiền):</span>
              <b className="dh-recon-val text-money">{order.gia_thuc_te?money(order.gia_thuc_te):'— (Theo Shopee)'}</b>
            </div>
            <div className="dh-recon-item">
              <span className="dh-recon-label">Tình trạng thực tế:</span>
              <span className={`dh-recon-tag ${order.tinh_trang_thuc_te?'has-val':''}`}>
                {order.tinh_trang_thuc_te||'Chưa cập nhật'}
              </span>
            </div>
            <div className="dh-recon-item">
              <span className="dh-recon-label">Xác nhận công nợ:</span>
              <span className={`dh-congno-badge ${(order.xac_nhan_cong_no||'CHỜ TÍNH').toLowerCase().replace(/\s+/g,'-')}`}>
                {order.xac_nhan_cong_no||'CHỜ TÍNH'}
              </span>
            </div>
            <div className="dh-recon-item">
              <span className="dh-recon-label">Ghi chú đối soát:</span>
              <span className="dh-recon-val">{order.ghi_chu||'—'}</span>
            </div>
          </div>
        ):(
          <div className="dh-edit-form">
            <div className="dh-form-row">
              <label>
                <span>Giá thực tế (₫) - Tính lại tiền cho đơn</span>
                <div className="dh-input-with-actions">
                  <input
                    type="number"
                    placeholder="Nhập giá thực tế nếu có điều chỉnh..."
                    value={giaThucTe}
                    onChange={e=>setGiaThucTe(e.target.value)}
                  />
                  {order.doanh_thu&&(
                    <button
                      type="button"
                      className="dh-preset-btn"
                      onClick={()=>setGiaThucTe(String(parseMoney(order.doanh_thu)))}
                      title="Lấy bằng doanh thu Shopee"
                    >
                      Lấy DT ({money(order.doanh_thu)})
                    </button>
                  )}
                  {order.tong_tien&&(
                    <button
                      type="button"
                      className="dh-preset-btn"
                      onClick={()=>setGiaThucTe(String(parseMoney(order.tong_tien)))}
                      title="Lấy bằng tổng tiền đơn"
                    >
                      Lấy Tổng tiền ({money(order.tong_tien)})
                    </button>
                  )}
                  {giaThucTe&&(
                    <button
                      type="button"
                      className="dh-preset-btn"
                      onClick={()=>setGiaThucTe('')}
                      title="Xóa giá thực tế"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </label>
            </div>

            <div className="dh-form-grid-2">
              <label>
                <span>Tình trạng thực tế (chính xác)</span>
                <div className="dh-combo-group">
                  <select
                    value={STATUS_PRESETS.includes(tinhTrangThucTe)?tinhTrangThucTe:(tinhTrangThucTe?'KHAC':'')}
                    onChange={e=>{
                      const val=e.target.value;
                      if(val!=='KHAC')setTinhTrangThucTe(val);
                    }}
                  >
                    <option value="">-- Chọn nhanh tình trạng --</option>
                    {STATUS_PRESETS.map(s=><option key={s} value={s}>{s}</option>)}
                    <option value="KHAC">Tự nhập khác...</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Nhập tình trạng chi tiết..."
                    value={tinhTrangThucTe}
                    onChange={e=>setTinhTrangThucTe(e.target.value)}
                    style={{marginTop:6}}
                  />
                </div>
              </label>

              <label>
                <span>Xác nhận công nợ</span>
                <select
                  value={xacNhanCongNo}
                  onChange={e=>setXacNhanCongNo(e.target.value)}
                >
                  <option value="CHỜ TÍNH">CHỜ TÍNH (Chưa hạch toán)</option>
                  <option value="ĐÃ TÍNH">ĐÃ TÍNH (Đã hạch toán công nợ)</option>
                  <option value="KHÔNG TÍNH">KHÔNG TÍNH (Bỏ qua công nợ)</option>
                </select>
              </label>
            </div>

            <div className="dh-form-grid-2">
              <label>
                <span>Mã vận đơn (MVD)</span>
                <input
                  type="text"
                  placeholder="Mã vận đơn..."
                  value={mvd}
                  onChange={e=>setMvd(e.target.value)}
                />
              </label>

              <label>
                <span>Ghi chú nội bộ</span>
                <input
                  type="text"
                  placeholder="Ghi chú điều chỉnh..."
                  value={ghiChu}
                  onChange={e=>setGhiChu(e.target.value)}
                />
              </label>
            </div>

            {saveError&&<p className="dh-error" role="alert">{saveError}</p>}
            {saveSuccess&&<p className="dh-success-msg"><CheckCircle2 size={15}/> {saveSuccess}</p>}

            <div className="dh-edit-actions">
              <button
                type="button"
                className="dh-primary dh-btn-save-submit"
                disabled={saving}
                onClick={handleSave}
              >
                <Save size={15}/> {saving?'Đang lưu vào Google Sheets…':'Lưu vào Sheet DH'}
              </button>
              <button
                type="button"
                className="dh-ghost"
                disabled={saving}
                onClick={()=>{setIsEditing(false);resetForm();}}
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>

      <h3>Sản phẩm ({order.items.length})</h3><div className="dh-scroll"><table><thead><tr><th>Sản phẩm / SKU phân loại</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((it,i)=><tr key={i}><td><Product item={it}/></td><td>{money(it.don_gia)}</td><td>{money(it.thanh_tien)}</td></tr>)}</tbody></table></div>
      <div className="dh-detail-grid"><section><h3>Khách hàng & giao nhận</h3>{fields([['Người mua','ten_khach'],['Người nhận','ng_nhan'],['Số điện thoại','sdt'],['Địa chỉ','dia_chi'],['Vận đơn','mvd'],['Đơn vị vận chuyển','don_vi_vc'],['Hình thức vận chuyển','hinh_thuc_vc'],['Hạn giao','han_giao'],['Ghi chú','ghi_chu']])}</section>
      <section><h3>Trạng thái & thời gian</h3>{fields([['Ngày đặt','ngay_gio'],['Trạng thái Shopee','mo_ta_trang_thai'],['Hoàn thành lúc','ngay_hoan_thanh'],['Hủy lúc','ngay_huy'],['Lý do hủy','ly_do_huy'],['Lý do trả / hoàn','ly_do_tra_hoan'],['Mã trạng thái gốc','ma_trang_thai']])}</section></div>
      <h3>Thanh toán & các khoản phí</h3><div className="dh-finances">{[['Tổng thanh toán','tong_tien'],['Doanh thu Shopee','doanh_thu'],['Phí vận chuyển','phi_vc'],['Tổng phụ phí','phu_phi'],['Tổng thuế','thue'],['Phí cố định','phi_co_dinh'],['Phí dịch vụ','phi_dich_vu'],['Phí giao dịch','phi_giao_dich'],['Thuế GTGT','thue_gtgt'],['Thuế TNCN','thue_tncn']].map(([label,key])=><div key={key}><small>{label}</small><b>{money(order[key])}</b></div>)}</div>
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
const COL_KEY='dh.hiddenColumns',EXTRA_KEY='dh.extraColumns';
// Mọi cột của sheet DH (trừ ô JSON gốc) đều có thể bật thêm vào bảng.
const LABELS={gian:'Gian',ngay_gio:'Ngày giờ đặt',mdh:'Mã đơn',mvd:'Mã vận đơn',tong_tien:'Tổng tiền',phi_vc:'Phí vận chuyển',phu_phi:'Phụ phí',thue:'Thuế',doanh_thu:'Doanh thu',trang_thai:'Trạng thái gốc',sku:'SKU phân loại',slg:'Số lượng',don_gia:'Đơn giá',thanh_tien:'Thành tiền',ten_khach:'Tên khách',ng_nhan:'Người nhận',dia_chi:'Địa chỉ',shop_id:'Shop ID',order_id:'Order ID',item_id:'Item ID',model_id:'Model ID',ten_sp:'Tên sản phẩm',phan_loai:'Phân loại',anh:'Ảnh',sku_san_pham:'SKU sản phẩm',nguoi_mua_id:'ID người mua',sdt:'Số điện thoại',don_vi_vc:'Đơn vị vận chuyển',hinh_thuc_vc:'Hình thức vận chuyển',thanh_toan:'Thanh toán',han_giao:'Hạn giao',ghi_chu:'Ghi chú',mo_ta_trang_thai:'Mô tả trạng thái',ma_trang_thai:'Mã trạng thái',ly_do_huy:'Lý do hủy',ly_do_tra_hoan:'Lý do trả/hoàn',ngay_hoan_thanh:'Ngày hoàn thành',ngay_huy:'Ngày hủy',phi_co_dinh:'Phí cố định',phi_dich_vu:'Phí dịch vụ',phi_giao_dich:'Phí giao dịch',thue_gtgt:'Thuế GTGT',thue_tncn:'Thuế TNCN',vc_nguoi_mua:'VC người mua trả',vc_tro_gia:'VC trợ giá',chi_tiet_phi:'Chi tiết phí',chi_tiet_dong_bo:'Chi tiết đồng bộ',dong_bo_luc:'Đồng bộ lúc',gia_thuc_te:'Giá thực tế',tinh_trang_thuc_te:'Tình trạng thực tế',xac_nhan_cong_no:'Xác nhận công nợ'};
const MONEY=new Set(['tong_tien','phi_vc','phu_phi','thue','doanh_thu','don_gia','thanh_tien','phi_co_dinh','phi_dich_vu','phi_giao_dich','thue_gtgt','thue_tncn','vc_nguoi_mua','vc_tro_gia','gia_thuc_te']);
const EXTRA=HEADERS.filter(h=>!RAW_HEADERS.includes(h)).map(h=>[h,LABELS[h]||h]);
// Cột cấp sản phẩm lấy theo từng dòng sản phẩm của đơn.
const extraValue=(o,k)=>{const v=o[k]!==''&&o[k]!=null?[o[k]]:[...new Set(o.items.map(i=>i[k]).filter(x=>x!==''&&x!=null))];return v.length?v.map(x=>MONEY.has(k)?money(x):String(x)).join(', '):'—';};
const SORTS=[['new','Mới nhất'],['old','Cũ nhất'],['money','Tổng tiền cao nhất']];
const fmtDate=v=>v?new Date(v).toLocaleDateString('vi-VN'):'—';
export default function OrdersTab(){
  const [data,setData]=useState({orders:[],headers:[]}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(0);
  const [search,setSearch]=useState(''),[shop,setShop]=useState(''),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[rangeLabel,setRangeLabel]=useState(''),[sort,setSort]=useState('new'),[page,setPage]=useState(1),[size,setSize]=useState(20),[selected,setSelected]=useState(null),[checked,setChecked]=useState(new Set());
  const [extras,setExtras]=useState(()=>{try{return new Set(JSON.parse(localStorage.getItem(EXTRA_KEY)||'[]'));}catch{return new Set();}});
  const [hidden,setHidden]=useState(()=>{try{return new Set(JSON.parse(localStorage.getItem(COL_KEY)||'[]'));}catch{return new Set();}});
  const busy=useRef(false),mounted=useRef(false);
  const refresh=useCallback(async()=>{if(busy.current)return;busy.current=true;setLoading(true);try{const next=await fetchDhSheet();if(mounted.current){setData(next);setError('');setLoaded(Date.now());}}catch(e){if(mounted.current)setError(e.message);}finally{busy.current=false;if(mounted.current)setLoading(false);}},[]);
  useEffect(()=>{mounted.current=true;refresh();const timer=setInterval(refresh,60000);return()=>{mounted.current=false;clearInterval(timer);};},[refresh]);
  useEffect(()=>{setPage(1);setChecked(new Set());},[search,shop,status,from,to,sort,size]);
  const toggleColumn=k=>setHidden(h=>{const n=new Set(h);n.has(k)?n.delete(k):n.add(k);try{localStorage.setItem(COL_KEY,JSON.stringify([...n]));}catch{/* bỏ qua */}return n;});
  const handleUpdateOrder=useCallback((updatedOrder)=>{
    setData(prev=>({
      ...prev,
      orders:prev.orders.map(o=>o.key===updatedOrder.key?updatedOrder:o)
    }));
    setSelected(updatedOrder);
  },[]);
  const shops=useMemo(()=>[...new Set(data.orders.map(o=>o.gian).filter(Boolean))].sort(),[data]);
  const base=useMemo(()=>data.orders.filter(o=>{
    const t=dateValue(o);
    if (shop && o.gian !== shop) return false;
    if (from && t < new Date(from+'T00:00:00').getTime()) return false;
    if (to && t > new Date(to+'T23:59:59').getTime()) return false;
    if (!search || !search.trim()) return true;
    const target = [
      o.gian,
      o.mdh,
      o.mvd,
      o.ten_khach,
      o.ng_nhan,
      o.sdt,
      o.don_vi_vc,
      ...o.items.flatMap(i => [i.ten_sp, i.phan_loai, i.sku, i.sku_san_pham])
    ].filter(Boolean).join(' ');
    return matchSearchQuery(target, search);
  }),[data,search,shop,from,to]);
  const counts=useMemo(()=>Object.fromEntries(STATUS.map(s=>[s,base.filter(o=>o.status===s).length])),[base]);
  const rows=useMemo(()=>base.filter(o=>!status||o.status===status).sort((a,b)=>sort==='money'?parseMoney(b.tong_tien)-parseMoney(a.tong_tien):sort==='old'?dateValue(a)-dateValue(b):dateValue(b)-dateValue(a)),[base,status,sort]);
  const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages),start=(current-1)*size,visible=rows.slice(start,start+size);
  const at=data.orders.reduce((m,o)=>Math.max(m,Date.parse(o.dong_bo_luc)||0),0);
  const close=useCallback(()=>setSelected(null),[]);
  const saveExtras=n=>{try{localStorage.setItem(EXTRA_KEY,JSON.stringify([...n]));}catch{/* bỏ qua */}return n;};
  const toggleExtra=k=>setExtras(e=>{const n=new Set(e);n.has(k)?n.delete(k):n.add(k);return saveExtras(n);});
  const extraCols=EXTRA.filter(([k])=>extras.has(k));
  const show=k=>!hidden.has(k), cols=COLUMNS.filter(([k])=>show(k));
  const allOnPage=visible.length>0&&visible.every(o=>checked.has(o.key));
  const pick=key=>setChecked(c=>{const n=new Set(c);n.has(key)?n.delete(key):n.add(key);return n;});
  const exportRows=checked.size?rows.filter(o=>checked.has(o.key)):rows;
  const filtered=!!(shop||from||to||sort!=='new'||search);
  const tabs=[['',base.length],...STATUS.filter(s=>counts[s]||s===status||['Chờ lấy hàng','Đang giao','Đã giao','Hoàn thành','Đã hủy','Trả hàng','Hoàn tiền'].includes(s)).map(s=>[s,counts[s]])];
    const total=rows.reduce((s,o)=>s+parseMoney(o.tong_tien),0);
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const n = (v) => {
      if (v === '' || v == null) return null;
      const num = parseMoney(v);
      return isNaN(num) ? null : num;
    };
    const sum = (key) => rows.reduce((s, r) => s + (n(r[key]) || 0), 0);
    const has = (key) => rows.filter((r) => n(r[key]) !== null).length;
    const note = (key) => (has(key) < rows.length ? ` (${has(key)}/${rows.length} đơn)` : '');

    return {
      count: rows.length,
      tongTien: sum('tong_tien'),
      doanhThu: sum('doanh_thu'),
      doanhThuNote: note('doanh_thu'),
      phuPhi: sum('phu_phi'),
      phuPhiNote: note('phu_phi'),
      thue: sum('thue'),
      thueNote: note('thue'),
      thanhTienSp: sum('tong_thanh_tien_sp'),
      thanhTienSpNote: note('tong_thanh_tien_sp'),
      loiNhuan: sum('loi_nhuan'),
      loiNhuanNote: note('loi_nhuan'),
    };
  }, [rows]);
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
        {filtered&&<button className="dh-ghost" onClick={()=>{setSearch('');setShop('');setFrom('');setTo('');setRangeLabel('');setSort('new');}}><ArrowLeft size={14}/>Bỏ lọc</button>}
        <label className="dh-search" title="Hỗ trợ tìm kiếm thông minh:&#10;• Phép VÀ (AND): cách nhau bằng dấu cách, dấu +, hoặc từ 'và'&#10;• Phép HOẶC (OR): cách nhau bằng dấu phẩy ',', dấu '|', hoặc từ 'hoặc'"><Search size={15}/><input aria-label="Tìm đơn hàng" placeholder="Tìm mã đơn, vận đơn, khách, sản phẩm, SKU… (hỗ trợ VÀ & HOẶC)" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Xoá tìm kiếm" onClick={()=>setSearch('')}><X size={13}/></button>}</label>
        <div className="dh-grow"/>
        <Dropdown icon={Columns3} label={`Tùy chỉnh cột${extras.size?` (+${extras.size})`:''}`} align="right"><div className="dh-cols">
          <b>Cột chính</b>{COLUMNS.map(([k,l])=><label key={k} className="dh-dd-check"><input type="checkbox" checked={show(k)} disabled={k==='order'} onChange={()=>toggleColumn(k)}/>{l}</label>)}
          <b>Cột từ sheet DH ({EXTRA.length})<span><button type="button" onClick={()=>setExtras(saveExtras(new Set(EXTRA.map(([k])=>k))))}>Hiện hết</button><button type="button" onClick={()=>setExtras(saveExtras(new Set()))}>Ẩn hết</button></span></b>
          {EXTRA.map(([k,l])=><label key={k} className="dh-dd-check"><input type="checkbox" checked={extras.has(k)} onChange={()=>toggleExtra(k)}/>{l}<small>{k}</small></label>)}
        </div></Dropdown>
        <button className="dh-ghost" onClick={()=>exportCsv(exportRows)} disabled={!exportRows.length}><Download size={14}/>{checked.size?`Xuất ${checked.size} đơn`:'Xuất CSV'}</button>
        <button className="dh-primary" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading?'dh-spin':''}/>Làm mới</button>
      </div>
      <div className="dh-filterbar">
        <Dropdown icon={Store} label={shop?`Gian: ${shop}`:'Gian'} active={!!shop}><Option on={!shop} onClick={()=>setShop('')}>Tất cả gian</Option>{shops.map(s=><Option key={s} on={shop===s} onClick={()=>setShop(s)}>{s}</Option>)}</Dropdown>
        <DateRangePicker from={from} to={to} label={rangeLabel} onChange={(f, t, lbl) => { setFrom(f); setTo(t); setRangeLabel(lbl); }} />
        <Dropdown icon={ArrowUpDown} label={SORTS.find(s=>s[0]===sort)[1]} active={sort!=='new'}>{SORTS.map(([v,l])=><Option key={v} on={sort===v} onClick={()=>setSort(v)}>{l}</Option>)}</Dropdown>
        <span className="dh-grow"/>
        <span className="dh-sum">{rows.length} đơn · Tổng thanh toán <b>{money(total)}</b></span>
      </div>
      {stats && (
        <div className="dh-stats-section">
          <div className="dh-stats-grid">
            <div className="dh-stat-card">
              <div className="dh-stat-v">{stats.count}</div>
              <div className="dh-stat-l">Đơn</div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v">{formatMoneyVND(stats.tongTien)}</div>
              <div className="dh-stat-l">Tổng tiền đơn</div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v text-income">{formatMoneyVND(stats.doanhThu)}</div>
              <div className="dh-stat-l">
                Doanh thu ước tính{stats.doanhThuNote && <small>{stats.doanhThuNote}</small>}
              </div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v">{formatMoneyVND(stats.phuPhi)}</div>
              <div className="dh-stat-l">
                Tổng phụ phí{stats.phuPhiNote && <small>{stats.phuPhiNote}</small>}
              </div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v">{formatMoneyVND(stats.thue)}</div>
              <div className="dh-stat-l">
                Tổng thuế{stats.thueNote && <small>{stats.thueNote}</small>}
              </div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v">{formatMoneyVND(stats.thanhTienSp)}</div>
              <div className="dh-stat-l">
                Tổng thành tiền SP{stats.thanhTienSpNote && <small>{stats.thanhTienSpNote}</small>}
              </div>
            </div>
            <div className="dh-stat-card">
              <div className="dh-stat-v text-income">{formatMoneyVND(stats.loiNhuan)}</div>
              <div className="dh-stat-l">
                Lợi nhuận{stats.loiNhuanNote && <small>{stats.loiNhuanNote}</small>}
              </div>
            </div>
          </div>
        </div>
      )}
      {error&&<div role="alert" className="dh-error">{error}. Dữ liệu đã tải trước đó được giữ lại.</div>}
      <div className="dh-scroll dh-list"><table className="dh-fixed" style={{minWidth:1180+extraCols.length*150}}><thead><tr><th className="dh-check"><input type="checkbox" aria-label="Chọn tất cả trên trang" checked={allOnPage} onChange={()=>setChecked(c=>{const n=new Set(c);visible.forEach(o=>allOnPage?n.delete(o.key):n.add(o.key));return n;})}/></th>{cols.map(([k,l])=><th key={k} className={`c-${k}`}>{l}</th>)}{extraCols.map(([k,l])=><th key={k} className="c-extra" title={k}>{l}</th>)}<th className="dh-act">Thao tác</th></tr></thead>
        <tbody>{visible.map(o=><tr key={o.key} className={checked.has(o.key)?'sel':''}><td className="dh-check"><input type="checkbox" aria-label={`Chọn đơn ${o.mdh}`} checked={checked.has(o.key)} onChange={()=>pick(o.key)}/></td>{cols.map(([k])=><td key={k} className={`c-${k}`}>{cells[k](o)}</td>)}{extraCols.map(([k])=>{const v=extraValue(o,k);return <td key={k} className="c-extra" title={v}><div className="dh-cell">{v}</div></td>;})}<td className="dh-act"><button className="dh-icon" title="Xem chi tiết" aria-label={`Xem chi tiết đơn ${o.mdh}`} onClick={()=>setSelected(o)}><Eye size={16}/></button></td></tr>)}
        {!visible.length&&<tr><td colSpan={cols.length+extraCols.length+2} className="dh-empty">{loading?'Đang đọc dữ liệu DH…':loaded?'Không có đơn phù hợp. Để tải lịch sử, mở extension → Đơn Shopee → Đồng bộ DH ngay.':'Chưa tải được dữ liệu.'}</td></tr>}</tbody></table></div>
      <footer className="dh-footer"><div className="dh-pagesize"><span>{rows.length?`${start+1}–${start+visible.length}`:'0'}/<i>Tổng:</i>{rows.length}</span><select aria-label="Số dòng mỗi trang" value={size} onChange={e=>setSize(Number(e.target.value))}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select><i>/ trang</i></div>
        <div className="dh-pager"><button aria-label="Trang đầu" disabled={current<=1} onClick={()=>setPage(1)}><ChevronsLeft size={14}/></button><button aria-label="Trang trước" disabled={current<=1} onClick={()=>setPage(current-1)}><ChevronLeft size={14}/></button><b>{current}</b><span>/{pages}</span><button aria-label="Trang sau" disabled={current>=pages} onClick={()=>setPage(current+1)}><ChevronRight size={14}/></button><button aria-label="Trang cuối" disabled={current>=pages} onClick={()=>setPage(pages)}><ChevronsRight size={14}/></button></div></footer>
    </div>
    {selected&&<Detail key={selected.key} order={selected} headers={data.headers} onUpdateOrder={handleUpdateOrder} onClose={close}/>}
  </div>;
}
