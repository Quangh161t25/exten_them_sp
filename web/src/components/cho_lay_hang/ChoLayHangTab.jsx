import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {fetchWaitingSheet} from '../../services/waitingOrdersSheet.js';
import {formatMoneyVND} from '../../utils/formatters.js';

const stamp = (at) => at ? new Date(at).toLocaleString('vi-VN') : 'Chưa đồng bộ';
export default function ChoLayHangTab() {
    const [rows,setRows]=useState([]), [at,setAt]=useState(0), [error,setError]=useState(''), [loading,setLoading]=useState(false);
    const [status,setStatus]=useState(0), [gian,setGian]=useState(''), [search,setSearch]=useState(''), [seconds,setSeconds]=useState(300);
    const [sort,setSort]=useState('shipByTs');
    const busy=useRef(false), mounted=useRef(false);
    const refresh=useCallback(async()=>{
        if(busy.current) return;
        busy.current=true;setLoading(true);
        try {const data=await fetchWaitingSheet();if(mounted.current){setRows(data.rows);setAt(data.at);setError('');}}
        catch(e){if(mounted.current)setError(e.message);}
        finally{busy.current=false;if(mounted.current)setLoading(false);}
    },[]);
    useEffect(()=>{mounted.current=true;refresh();return()=>{mounted.current=false;};},[refresh]);
    useEffect(()=>{if(!seconds)return;const id=setInterval(()=>{if(!document.hidden)refresh();},seconds*1000);return()=>clearInterval(id);},[seconds,refresh]);
    const shops=useMemo(()=>[...new Set(rows.map(r=>r.gian))].sort(),[rows]);
    const filtered=useMemo(()=>{
        const q=search.trim().toLocaleLowerCase('vi-VN');
        return rows.filter(r=>(!status||r.stage===status)&&(!gian||r.gian===gian)&&(!q||[r.gian,r.orderSn,r.buyer,r.tracking,...r.items].join(' ').toLocaleLowerCase('vi-VN').includes(q)))
            .sort((a,b)=>sort==='total'?b.total-a.total:sort==='orderTime'?b.orderTime-a.orderTime:(a.shipByTs||Infinity)-(b.shipByTs||Infinity));
    },[rows,status,gian,search,sort]);
    const td={padding:'10px',borderBottom:'1px solid #e2e8f0',verticalAlign:'top',fontSize:12};
    const control={padding:'7px 10px',border:'1px solid #cbd5e1',borderRadius:6,background:'#fff'};
    const old=at>0&&Date.now()-at>10*60*1000;
    return <div style={{display:'flex',flexDirection:'column',gap:12,width:'100%'}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:12,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8}}>
            <b>CHỜ LẤY HÀNG</b>
            <select aria-label="Trạng thái" style={control} value={status} onChange={e=>setStatus(Number(e.target.value))}><option value={0}>Tất cả trạng thái</option><option value={1}>Chưa xử lý</option><option value={2}>Đã xử lý / Chờ bưu tá</option></select>
            <select aria-label="Mã gian" style={control} value={gian} onChange={e=>setGian(e.target.value)}><option value="">Tất cả gian</option>{shops.map(s=><option key={s}>{s}</option>)}</select>
            <input aria-label="Tìm đơn" style={{...control,flex:1,minWidth:180}} placeholder="Tìm mã đơn, sản phẩm, SKU, người mua..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <button style={control} disabled={loading} onClick={refresh}>{loading?'Đang tải…':'Làm mới'}</button>
            <select aria-label="Tự động làm mới" style={control} value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value={0}>Tắt tự làm mới</option>{[30,60,120,300].map(n=><option key={n} value={n}>Làm mới mỗi {n} giây</option>)}</select>
            <select aria-label="Sắp xếp" style={control} value={sort} onChange={e=>setSort(e.target.value)}><option value="shipByTs">Hạn giao gần nhất</option><option value="orderTime">Đơn mới nhất</option><option value="total">Tổng tiền giảm dần</option></select>
        </div>
        <div style={{fontSize:12,color:old?'#b45309':'#64748b'}}>Nguồn: Google Sheets · ĐƠN CHƯA XLY · Đồng bộ Auto In: {stamp(at)}{old?' · Dữ liệu đã cũ, kiểm tra máy đang chạy Auto In.':''}</div>
        {error&&<div role="alert" style={{padding:12,background:'#fef2f2',color:'#b91c1c'}}>Không tải được dữ liệu: {error}. Dữ liệu đang hiển thị được giữ lại.</div>}
        <div style={{display:'flex',gap:20,flexWrap:'wrap',padding:12,background:'#fff',borderRadius:8}}><span><b>{filtered.length}</b> đơn</span><span>Chưa xử lý: <b>{filtered.filter(r=>r.stage===1).length}</b></span><span>Chờ bưu tá: <b>{filtered.filter(r=>r.stage===2).length}</b></span><span>Tổng tiền: <b>{formatMoneyVND(filtered.reduce((s,r)=>s+r.total,0))}</b></span></div>
        <div style={{overflowX:'auto',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8}}><table style={{borderCollapse:'collapse',width:'100%',minWidth:1250}}><thead><tr>{['Gian','Mã đơn','Ngày đặt','Người mua','Trạng thái','Sản phẩm','Phân loại','SKU phân loại','SL','Tổng tiền đơn','Vận chuyển','Hạn giao'].map(h=><th key={h} style={{...td,textAlign:'left',background:'#f8fafc',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead><tbody>
            {filtered.flatMap(r=>r.itemRows.map((it,i)=><tr key={`${r.key}:${i}`}>
                {i===0&&<><td style={td} rowSpan={r.itemRows.length}>{r.gian}</td><td style={td} rowSpan={r.itemRows.length}><a href={`https://banhang.shopee.vn/portal/sale/order/${encodeURIComponent(r.orderId)}`} target="_blank" rel="noreferrer">{r.orderSn}</a></td><td style={td} rowSpan={r.itemRows.length}>{r.orderTime?stamp(r.orderTime):''}</td><td style={td} rowSpan={r.itemRows.length}>{r.buyer}</td><td style={td} rowSpan={r.itemRows.length}>{r.stage===1?'Chưa xử lý':'Đã xử lý'}<div style={{color:'#b45309'}}>{r.tag}</div></td></>}
                <td style={{...td,minWidth:260}}><div style={{display:'flex',gap:8}}>{/^https?:\/\//i.test(it.image||'')&&<img alt="" src={it.image} loading="lazy" style={{width:40,height:40,objectFit:'contain'}}/>}<span>{it.name}</span></div></td><td style={td}>{it.model}</td><td style={{...td,color:'#ea580c'}}>{it.modelSku}</td><td style={td}>{it.qty}</td>
                {i===0&&<><td style={td} rowSpan={r.itemRows.length}>{formatMoneyVND(r.total)}</td><td style={td} rowSpan={r.itemRows.length}>{r.carrier}<div>{r.tracking}</div></td><td style={td} rowSpan={r.itemRows.length}>{r.shipBy}</td></>}
            </tr>))}
            {!filtered.length&&<tr><td colSpan={12} style={{...td,textAlign:'center',padding:30}}>{loading?'Đang tải…':at?'Không có đơn phù hợp.':'Chưa có dữ liệu. Mở Auto In trên máy tính và bấm Đọc ngay để đồng bộ.'}</td></tr>}
        </tbody></table></div>
    </div>;
}
