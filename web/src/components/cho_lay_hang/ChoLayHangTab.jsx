import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUpDown, RefreshCw, Store, Timer} from 'lucide-react';
import {fetchWaitingSheet} from '../../services/waitingOrdersSheet.js';
import {formatMoneyVND} from '../../utils/formatters.js';
import {matchSearchQuery} from '../../../../shared/dh-sheet.js';
import {Page, Crumbs, Tabs, Card, Toolbar, FilterBar, Grow, SearchBox, Dropdown, Option, SelectFilter, Pager} from '../common/PageShell.jsx';

const stamp = (at) => at ? new Date(at).toLocaleString('vi-VN') : 'Chưa đồng bộ';
const SORTS = [['shipByTs','Hạn giao gần nhất'],['orderTime','Đơn mới nhất'],['total','Tổng tiền giảm dần']];
export default function ChoLayHangTab() {
    const [rows,setRows]=useState([]), [at,setAt]=useState(0), [error,setError]=useState(''), [loading,setLoading]=useState(false);
    const [status,setStatus]=useState(0), [gian,setGian]=useState(''), [search,setSearch]=useState(''), [seconds,setSeconds]=useState(300);
    const [sort,setSort]=useState('shipByTs'), [page,setPage]=useState(1), [size,setSize]=useState(20);
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
    useEffect(()=>setPage(1),[status,gian,search,sort,size]);
    const shops=useMemo(()=>[...new Set(rows.map(r=>r.gian))].sort(),[rows]);
    const base=useMemo(()=>{
        return rows.filter(r=>{
            if (gian && r.gian !== gian) return false;
            if (!search || !search.trim()) return true;
            const target = [r.gian, r.orderSn, r.buyer, r.tracking, ...r.items].filter(Boolean).join(' ');
            return matchSearchQuery(target, search);
        });
    },[rows,gian,search]);
    const filtered=useMemo(()=>base.filter(r=>!status||r.stage===status)
        .sort((a,b)=>sort==='total'?b.total-a.total:sort==='orderTime'?b.orderTime-a.orderTime:(a.shipByTs||Infinity)-(b.shipByTs||Infinity)),[base,status,sort]);
    const visible=filtered.slice((Math.min(page,Math.max(1,Math.ceil(filtered.length/size)))-1)*size).slice(0,size);
    const old=at>0&&Date.now()-at>10*60*1000;
    return <Page>
        <Crumbs group="Bán hàng" title="Chờ lấy hàng" right={loading?'Đang tải…':`Đồng bộ Auto In: ${stamp(at)}`}/>
        <Tabs label="Trạng thái" value={status} onChange={setStatus} tabs={[[0,'Tất cả',base.length],[1,'Chưa xử lý',base.filter(r=>r.stage===1).length],[2,'Đã xử lý / Chờ bưu tá',base.filter(r=>r.stage===2).length]]}/>
        <Card>
            <Toolbar>
                <SearchBox value={search} onChange={setSearch} placeholder="Tìm mã đơn, sản phẩm, SKU, người mua…"/>
                <Grow/>
                <Dropdown icon={Timer} label={seconds?`Tự làm mới ${seconds}s`:'Tắt tự làm mới'} align="right"><Option on={!seconds} onClick={()=>setSeconds(0)}>Tắt tự làm mới</Option>{[30,60,120,300].map(n=><Option key={n} on={seconds===n} onClick={()=>setSeconds(n)}>Mỗi {n} giây</Option>)}</Dropdown>
                <button className="dh-primary" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading?'dh-spin':''}/>Làm mới</button>
            </Toolbar>
            <FilterBar>
                <SelectFilter icon={Store} name="Gian" value={gian} onChange={setGian} options={shops.map(s=>[s,s])} allLabel="Tất cả gian"/>
                <Dropdown icon={ArrowUpDown} label={SORTS.find(s=>s[0]===sort)[1]} active={sort!=='shipByTs'}>{SORTS.map(([v,l])=><Option key={v} on={sort===v} onClick={()=>setSort(v)}>{l}</Option>)}</Dropdown>
                <Grow/>
                <span className="dh-sum">{filtered.length} đơn · Tổng tiền <b>{formatMoneyVND(filtered.reduce((s,r)=>s+r.total,0))}</b></span>
            </FilterBar>
            {old&&<div className="dh-note" style={{margin:'10px 12px 0',color:'#b45309',background:'#fffbeb'}}>Dữ liệu đã cũ hơn 10 phút, kiểm tra máy đang chạy Auto In.</div>}
            {error&&<div role="alert" className="dh-error">Không tải được dữ liệu: {error}. Dữ liệu đang hiển thị được giữ lại.</div>}
            <div className="dh-scroll dh-list"><table style={{minWidth:1250}}><thead><tr>{['Gian','Mã đơn','Ngày đặt','Người mua','Trạng thái','Sản phẩm','Phân loại','SKU phân loại','SL','Tổng tiền đơn','Vận chuyển','Hạn giao'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
                {visible.flatMap(r=>r.itemRows.map((it,i)=><tr key={`${r.key}:${i}`}>
                    {i===0&&<><td rowSpan={r.itemRows.length}><span className="dh-shop">{r.gian}</span></td><td rowSpan={r.itemRows.length}><a className="dh-order-link" href={`https://banhang.shopee.vn/portal/sale/order/${encodeURIComponent(r.orderId)}`} target="_blank" rel="noreferrer">{r.orderSn}</a></td><td rowSpan={r.itemRows.length}>{r.orderTime?stamp(r.orderTime):''}</td><td rowSpan={r.itemRows.length}>{r.buyer}</td><td rowSpan={r.itemRows.length}><span className={`dh-badge ${r.stage===1?'orange':'blue'}`}>{r.stage===1?'Chưa xử lý':'Đã xử lý'}</span><small>{r.tag}</small></td></>}
                    <td style={{minWidth:260}}><div className="dh-product">{/^https?:\/\//i.test(it.image||'')?<img alt="" src={it.image} loading="lazy"/>:<span className="dh-image-placeholder">SP</span>}<div><strong>{it.name}</strong></div></div></td><td>{it.model}</td><td><code style={{color:'#4f46e5',fontSize:11}}>{it.modelSku}</code></td><td>{it.qty}</td>
                    {i===0&&<><td rowSpan={r.itemRows.length} className="dh-money"><b>{formatMoneyVND(r.total)}</b></td><td rowSpan={r.itemRows.length}>{r.carrier}<small className="dh-mono">{r.tracking}</small></td><td rowSpan={r.itemRows.length}>{r.shipBy}</td></>}
                </tr>))}
                {!filtered.length&&<tr><td colSpan={12} className="dh-empty">{loading?'Đang tải…':at?'Không có đơn phù hợp.':'Chưa có dữ liệu. Mở Auto In trên máy tính và bấm Đọc ngay để đồng bộ.'}</td></tr>}
            </tbody></table></div>
            <Pager page={page} total={filtered.length} size={size} onPage={setPage} onSize={setSize}/>
        </Card>
    </Page>;
}
