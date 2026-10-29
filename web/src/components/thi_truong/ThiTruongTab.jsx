import React, {useCallback, useState} from 'react';
import {getApiKey, setApiKey, searchMarket, fetchPriceHistory, fetchShopProducts, parseItemId} from '../../services/addlivetagApi.js';
import {formatMoneyVND} from '../../utils/formatters.js';

const num = (v) => (Number(v) || 0).toLocaleString('vi-VN');
const pct = (v) => v == null ? '' : `${Math.round(v * 1000) / 10}%`;
const short = (v) => { const n = Number(v) || 0; return n >= 1e9 ? `${(n / 1e9).toFixed(1)} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} tr` : num(n); };
const control = {padding:'7px 10px',border:'1px solid #cbd5e1',borderRadius:6,background:'#fff',fontSize:12};
const td = {padding:'8px 10px',borderBottom:'1px solid #e2e8f0',verticalAlign:'top',fontSize:12,textAlign:'left'};
const box = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:12};
const SORTS = [['revenue_all','Doanh thu luỹ kế'],['revenue_30d','Doanh thu 30 ngày'],['sold_30d','Bán 30 ngày'],['sales','Lượt bán luỹ kế'],['growth','Đang tăng tốc'],['comm_rate','Hoa hồng'],['price','Giá']];

// Biểu đồ giá dạng bậc thang: giá giữ nguyên tới mốc đổi giá tiếp theo.
function PriceChart({points, to}) {
    if (!points.length) return <p style={{fontSize:12,color:'#64748b'}}>Chưa có lịch sử giá.</p>;
    const W = 420, H = 140, P = 6;
    const t = points.map(p => Date.parse(p.date)), end = Math.max(Date.parse(to) || 0, t[t.length - 1]);
    const prices = points.map(p => p.price), lo = Math.min(...prices), hi = Math.max(...prices);
    const x = v => P + (end === t[0] ? 0 : (v - t[0]) / (end - t[0]) * (W - 2 * P));
    const y = v => H - P - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (H - 2 * P);
    let d = `M${x(t[0])},${y(prices[0])}`;
    for (let i = 1; i < t.length; i++) d += ` H${x(t[i])} V${y(prices[i])}`;
    d += ` H${x(end)}`;
    return <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',background:'#f8fafc',borderRadius:6}} role="img" aria-label="Biểu đồ lịch sử giá">
        <path d={d} fill="none" stroke="#4f46e5" strokeWidth="2"/>
        <text x={P} y={12} fontSize="10" fill="#64748b">{formatMoneyVND(hi)}</text>
        <text x={P} y={H - 8} fontSize="10" fill="#64748b">{formatMoneyVND(lo)}</text>
    </svg>;
}

export default function ThiTruongTab() {
    const [key, setKey] = useState(getApiKey()), [keyDraft, setKeyDraft] = useState(getApiKey());
    const [q, setQ] = useState(''), [priceMin, setPriceMin] = useState(''), [priceMax, setPriceMax] = useState(''), [sort, setSort] = useState('revenue_all');
    const [market, setMarket] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
    const [lookup, setLookup] = useState(''), [detail, setDetail] = useState(null), [detailLoading, setDetailLoading] = useState(false);
    const [shop, setShop] = useState(null);

    const saveKey = () => { setApiKey(keyDraft); setKey(keyDraft.trim()); setError(''); };
    const search = useCallback(async (e) => {
        e?.preventDefault();
        if (!q.trim()) return;
        setLoading(true); setError('');
        try { setMarket(await searchMarket(q.trim(), {sort, price_min: priceMin, price_max: priceMax, limit: 100})); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [q, sort, priceMin, priceMax]);

    const openProduct = useCallback(async (itemId, base = {}) => {
        if (!itemId) { setError('Không nhận ra item_id. Dán link shopee.vn đầy đủ hoặc nhập số item_id.'); return; }
        setDetail({itemId, ...base, history: null}); setShop(null); setDetailLoading(true); setError('');
        try {
            const r = await fetchPriceHistory(itemId, 180), it = r.items?.[0] || {};
            setDetail(d => d?.itemId !== itemId ? d : {...d, ...(it.product || {}), ...base, history: it.price || {points: []}, to: r.range?.to, status: it.status});
        } catch (err) { setError(err.message); }
        finally { setDetailLoading(false); }
    }, []);

    const openShop = useCallback(async (shopId) => {
        setShop({shopId, loading: true, products: []});
        try { const r = await fetchShopProducts(shopId); setShop({shopId, shopName: r.shopName, products: r.products || [], hasNextPage: r.hasNextPage}); }
        catch (err) { setShop(null); setError(err.message); }
    }, []);

    const m = market?.market, h = detail?.history, st = h?.stats || {}, all = h?.allTime || {};
    return <div style={{display:'flex',flexDirection:'column',gap:12,width:'100%'}}>
        <div style={{...box,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <b>THỊ TRƯỜNG</b>
            <input type="password" aria-label="API Key addlivetag" style={{...control,width:240}} placeholder="Dán API Key addlivetag" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}/>
            <button style={control} onClick={saveKey}>Lưu Key</button>
            <span style={{fontSize:12,color:key ? '#15803d' : '#b45309'}}>{key ? 'Đã có Key (lưu trên máy này)' : 'Chưa có Key — tạo ở addlivetag.com → API Key'}</span>
        </div>

        <form onSubmit={search} style={{...box,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input aria-label="Từ khoá" style={{...control,flex:1,minWidth:200}} placeholder="Từ khoá sản phẩm, vd: áo mưa, kem chống nắng…" value={q} onChange={e => setQ(e.target.value)}/>
            <input aria-label="Giá từ" type="number" style={{...control,width:110}} placeholder="Giá từ" value={priceMin} onChange={e => setPriceMin(e.target.value)}/>
            <input aria-label="Giá đến" type="number" style={{...control,width:110}} placeholder="Giá đến" value={priceMax} onChange={e => setPriceMax(e.target.value)}/>
            <select aria-label="Sắp xếp" style={control} value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="submit" style={{...control,background:'#4f46e5',color:'#fff',borderColor:'#4f46e5'}} disabled={loading || !key}>{loading ? 'Đang tìm…' : 'Phân tích'}</button>
            <span style={{width:1,height:24,background:'#e2e8f0'}}/>
            <input aria-label="Tra sản phẩm" style={{...control,minWidth:220}} placeholder="item_id hoặc link SP đối thủ" value={lookup} onChange={e => setLookup(e.target.value)}/>
            <button type="button" style={control} disabled={!key} onClick={() => openProduct(parseItemId(lookup))}>Xem lịch sử giá</button>
        </form>

        {error && <div role="alert" style={{padding:10,background:'#fef2f2',color:'#b91c1c'}}>{error}</div>}

        {m && <div style={{...box,display:'flex',gap:22,flexWrap:'wrap',fontSize:12}}>
            <span>Sản phẩm: <b>{num(m.totalProducts)}</b></span>
            <span>Shop: <b>{num(m.totalShops)}</b></span>
            <span>Doanh thu luỹ kế: <b>{short(m.totalRevenue)}</b></span>
            <span>Doanh thu 30 ngày*: <b>{short(market.last30Days?.totalRevenue)}</b></span>
            <span>Giá TB: <b>{formatMoneyVND(m.avgPrice)}</b></span>
            <span>Tỷ lệ có bán: <b>{pct(m.sellThroughRate)}</b></span>
            <span title="0–100, cao = dễ vào">Điểm dễ vào: <b>{m.blueOceanScore}</b></span>
            <span title="Gần 0 = phân tán, gần 1 = vài shop thống trị">Độ tập trung (HHI): <b>{m.hhi}</b></span>
            <span style={{color:'#94a3b8'}}>*chỉ tính {pct(market.last30Days?.coverage)} SP đủ lịch sử · khớp: {market.query?.matchMode}{market.cached ? ' · cache' : ''}</span>
        </div>}

        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
            <div style={{flex:'1 1 640px',overflow:'auto',maxHeight:'70vh',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8}}>
                <table style={{borderCollapse:'collapse',width:'100%',minWidth:900}}><thead><tr>{['Sản phẩm','Shop','Giá','Đã bán','Bán 30N','DT 30N','Tăng tốc','HH','★'].map(c => <th key={c} style={{...td,background:'#f8fafc',position:'sticky',top:0,whiteSpace:'nowrap'}}>{c}</th>)}</tr></thead><tbody>
                    {(market?.products || []).map(p => <tr key={p.itemId} style={{background:detail?.itemId === String(p.itemId) ? '#eef2ff' : '#fff',cursor:'pointer'}} onClick={() => openProduct(String(p.itemId), {productName: p.productName, imageUrl: p.imageUrl, productLink: p.productLink, shopId: p.shopId, shopName: p.shopName})}>
                        <td style={{...td,minWidth:280}}><div style={{display:'flex',gap:8}}>{p.imageUrl && <img alt="" src={p.imageUrl} loading="lazy" style={{width:40,height:40,objectFit:'cover',borderRadius:4}}/>}<span>{p.productName}</span></div></td>
                        <td style={td}>{p.shopName}</td>
                        <td style={td}>{formatMoneyVND(p.price)}</td>
                        <td style={td}>{num(p.sales)}</td>
                        <td style={td}>{num(p.sold30d)}</td>
                        <td style={td}>{short(p.revenue30d)}</td>
                        <td style={{...td,color:p.growth > 1 ? '#15803d' : p.growth && p.growth < 1 ? '#b91c1c' : undefined}}>{p.growth ? `×${p.growth}` : ''}</td>
                        <td style={td}>{pct(p.commissionRate)}</td>
                        <td style={td}>{p.rating}</td>
                    </tr>)}
                    {!market?.products?.length && <tr><td colSpan={9} style={{...td,textAlign:'center',padding:30,color:'#64748b'}}>{loading ? 'Đang phân tích…' : market ? 'Không có sản phẩm phù hợp.' : 'Nhập từ khoá rồi bấm Phân tích để xem thị trường. Bấm một dòng để xem lịch sử giá.'}</td></tr>}
                </tbody></table>
            </div>

            {detail && <section style={{...box,flex:'1 1 360px',minWidth:0,display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',gap:10}}>
                    {detail.imageUrl && <img alt="" src={detail.imageUrl} style={{width:64,height:64,objectFit:'cover',borderRadius:6}}/>}
                    <div style={{fontSize:13}}><b>{detail.productName || `SP ${detail.itemId}`}</b>
                        <div style={{fontSize:11,color:'#64748b',marginTop:4}}>ID {detail.itemId}{detail.shopName ? ` · ${detail.shopName}` : ''}{detail.productLink && <> · <a href={detail.productLink} target="_blank" rel="noreferrer">Mở Shopee</a></>}</div>
                    </div>
                </div>
                <b style={{fontSize:12}}>Lịch sử giá 180 ngày</b>
                {detailLoading ? <p style={{fontSize:12}}>Đang tải…</p> : h && <>
                    <PriceChart points={h.points || []} to={detail.to}/>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12}}>
                        <span>Hiện tại: <b>{formatMoneyVND(all.currentPrice ?? st.last)}</b></span>
                        <span>Số lần đổi giá: <b>{st.changeCount ?? 0}</b></span>
                        <span>Thấp nhất: <b>{formatMoneyVND(st.min)}</b> {st.minDate}</span>
                        <span>Cao nhất: <b>{formatMoneyVND(st.max)}</b> {st.maxDate}</span>
                        <span>Trung bình: <b>{formatMoneyVND(Math.round(st.avg || 0))}</b></span>
                        <span>Đáy mọi thời: <b>{formatMoneyVND(all.minPrice)}</b></span>
                    </div>
                    {detail.status === 'no_data' && <p style={{fontSize:12,color:'#b45309'}}>Kho dữ liệu chưa theo dõi sản phẩm này.</p>}
                    <div style={{maxHeight:160,overflowY:'auto',fontSize:12}}>{[...(h.points || [])].reverse().map(p => <div key={p.date} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid #f1f5f9',padding:'3px 0'}}><span>{p.date}{p.flashSale ? ' ⚡' : ''}</span><b>{formatMoneyVND(p.price)}</b></div>)}</div>
                </>}
                {detail.shopId && <button style={control} onClick={() => openShop(detail.shopId)}>Xem SP có hoa hồng của shop này</button>}
                {shop && <div style={{fontSize:12}}>
                    <b>{shop.loading ? 'Đang tải shop…' : `${shop.shopName || shop.shopId}: ${shop.products.length}${shop.hasNextPage ? '+' : ''} SP`}</b>
                    <div style={{maxHeight:240,overflowY:'auto',marginTop:6}}>{shop.products.map(p => <div key={p.itemId} style={{display:'flex',gap:6,padding:'4px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}} onClick={() => openProduct(String(p.itemId), {productName: p.name, imageUrl: p.image, productLink: p.link, shopId: p.shopId, shopName: p.shopName})}>
                        {p.image && <img alt="" src={p.image} loading="lazy" style={{width:32,height:32,objectFit:'cover'}}/>}<span style={{flex:1}}>{p.name}</span><span>{formatMoneyVND(p.price)}<div style={{color:'#64748b'}}>{num(p.sales)} bán</div></span>
                    </div>)}</div>
                </div>}
            </section>}
        </div>
    </div>;
}
