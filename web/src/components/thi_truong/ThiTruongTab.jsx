import React, {useCallback, useState} from 'react';
import {KeyRound, Search, Wallet, LineChart} from 'lucide-react';
import {getApiKey, setApiKey, searchMarket, fetchPriceHistory, fetchShopProducts, parseItemId} from '../../services/addlivetagApi.js';
import {formatMoneyVND} from '../../utils/formatters.js';
import {Page, Crumbs, Tabs, Card, Toolbar, FilterBar, Grow, SearchBox, Dropdown} from '../common/PageShell.jsx';

const num = (v) => (Number(v) || 0).toLocaleString('vi-VN');
const pct = (v) => v == null ? '' : `${Math.round(v * 1000) / 10}%`;
const short = (v) => { const n = Number(v) || 0; return n >= 1e9 ? `${(n / 1e9).toFixed(1)} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} tr` : num(n); };
const field = {padding:'7px 10px',border:'1px solid #d9e0eb',borderRadius:8,fontSize:12};
const SORTS = [['revenue_all','Doanh thu luỹ kế'],['revenue_30d','Doanh thu 30 ngày'],['sold_30d','Bán 30 ngày'],['sales','Lượt bán'],['growth','Đang tăng tốc'],['comm_rate','Hoa hồng'],['price','Giá']];

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
    const run = useCallback(async (opts) => {
        const o = {q, sort, priceMin, priceMax, ...opts};
        if (!o.q.trim()) return;
        setLoading(true); setError('');
        try { setMarket(await searchMarket(o.q.trim(), {sort: o.sort, price_min: o.priceMin, price_max: o.priceMax, limit: 100})); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [q, sort, priceMin, priceMax]);
    const changeSort = (v) => { setSort(v); if (market) run({sort: v}); };

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
    return <Page>
        <Crumbs group="Nghiên cứu" title="Thị trường" right={key ? 'API addlivetag: đã có Key' : 'API addlivetag: chưa có Key'}/>
        <Tabs label="Sắp xếp sản phẩm" value={sort} onChange={changeSort} tabs={SORTS}/>
        <Card>
            <Toolbar>
                <form onSubmit={e => { e.preventDefault(); run(); }} style={{display:'contents'}}>
                    <SearchBox value={q} onChange={setQ} placeholder="Từ khoá sản phẩm, vd: áo mưa, kem chống nắng…"/>
                    <button type="submit" className="dh-primary" disabled={loading || !key}><Search size={14}/>{loading ? 'Đang phân tích…' : 'Phân tích'}</button>
                </form>
                <Grow/>
                <form onSubmit={e => { e.preventDefault(); openProduct(parseItemId(lookup)); }} style={{display:'flex',gap:6}}>
                    <input aria-label="Tra sản phẩm" style={{...field,width:220}} placeholder="item_id hoặc link SP đối thủ" value={lookup} onChange={e => setLookup(e.target.value)}/>
                    <button type="submit" className="dh-ghost" disabled={!key}><LineChart size={14}/>Lịch sử giá</button>
                </form>
                <Dropdown icon={KeyRound} label="API Key" active={!key} align="right">
                    <div className="dh-dd-dates"><label>API Key addlivetag<input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="Dán API Key"/></label>
                    <button type="button" data-close className="dh-primary" onClick={saveKey}>Lưu Key</button>
                    <small style={{color:'#64748b'}}>Key chỉ lưu trên máy này. Tạo ở addlivetag.com → API Key.</small></div>
                </Dropdown>
            </Toolbar>
            <FilterBar>
                <Dropdown icon={Wallet} label={priceMin || priceMax ? `Giá: ${priceMin ? num(priceMin) : '0'} → ${priceMax ? num(priceMax) : '∞'}` : 'Khoảng giá'} active={!!(priceMin || priceMax)}>
                    <div className="dh-dd-dates"><label>Giá từ<input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)}/></label><label>Giá đến<input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)}/></label>
                    <div className="dh-dd-quick"><button type="button" data-close onClick={() => run()}>Áp dụng</button><button type="button" data-close onClick={() => { setPriceMin(''); setPriceMax(''); run({priceMin: '', priceMax: ''}); }}>Bỏ chọn</button></div></div>
                </Dropdown>
                <Grow/>
                {m ? <span className="dh-sum">Sản phẩm <b>{num(m.totalProducts)}</b> · Shop <b>{num(m.totalShops)}</b> · DT luỹ kế <b>{short(m.totalRevenue)}</b> · DT 30N* <b>{short(market.last30Days?.totalRevenue)}</b> · Giá TB <b>{formatMoneyVND(m.avgPrice)}</b> · Có bán <b>{pct(m.sellThroughRate)}</b> · <span title="0–100, cao = dễ vào">Dễ vào <b>{m.blueOceanScore}</b></span> · <span title="Gần 0 = phân tán">HHI <b>{m.hhi}</b></span></span>
                    : <span className="dh-sum">Nhập từ khoá rồi bấm Phân tích để xem toàn cảnh thị trường.</span>}
            </FilterBar>
            {error && <div role="alert" className="dh-error">{error}</div>}
            <div style={{display:'flex',flexWrap:'wrap',minHeight:0}}>
                <div className="dh-scroll dh-list" style={{flex:'1 1 640px',minWidth:0}}>
                    <table style={{minWidth:900}}><thead><tr>{['Sản phẩm','Shop','Giá','Đã bán','Bán 30N','DT 30N','Tăng tốc','HH','★'].map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>
                        {(market?.products || []).map(p => <tr key={p.itemId} className={detail?.itemId === String(p.itemId) ? 'sel' : ''} style={{cursor:'pointer'}} onClick={() => openProduct(String(p.itemId), {productName: p.productName, imageUrl: p.imageUrl, productLink: p.productLink, shopId: p.shopId, shopName: p.shopName})}>
                            <td style={{minWidth:280}}><div className="dh-product">{p.imageUrl ? <img alt="" src={p.imageUrl} loading="lazy"/> : <span className="dh-image-placeholder">SP</span>}<div><strong>{p.productName}</strong></div></div></td>
                            <td>{p.shopName}</td>
                            <td>{formatMoneyVND(p.price)}</td>
                            <td>{num(p.sales)}</td>
                            <td>{num(p.sold30d)}</td>
                            <td>{short(p.revenue30d)}</td>
                            <td style={{color:p.growth > 1 ? '#15803d' : p.growth && p.growth < 1 ? '#b91c1c' : undefined}}>{p.growth ? `×${p.growth}` : ''}</td>
                            <td>{pct(p.commissionRate)}</td>
                            <td>{p.rating}</td>
                        </tr>)}
                        {!market?.products?.length && <tr><td colSpan={9} className="dh-empty">{loading ? 'Đang phân tích…' : market ? 'Không có sản phẩm phù hợp.' : key ? 'Bấm một dòng để xem lịch sử giá.' : 'Bấm nút API Key để nhập Key trước khi dùng.'}</td></tr>}
                    </tbody></table>
                </div>

                {detail && <section style={{flex:'1 1 360px',minWidth:0,borderLeft:'1px solid #eef1f6',padding:14,display:'flex',flexDirection:'column',gap:10}}>
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
                    {detail.shopId && <button className="dh-ghost" onClick={() => openShop(detail.shopId)}>Xem SP có hoa hồng của shop này</button>}
                    {shop && <div style={{fontSize:12}}>
                        <b>{shop.loading ? 'Đang tải shop…' : `${shop.shopName || shop.shopId}: ${shop.products.length}${shop.hasNextPage ? '+' : ''} SP`}</b>
                        <div style={{maxHeight:240,overflowY:'auto',marginTop:6}}>{shop.products.map(p => <div key={p.itemId} style={{display:'flex',gap:6,padding:'4px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}} onClick={() => openProduct(String(p.itemId), {productName: p.name, imageUrl: p.image, productLink: p.link, shopId: p.shopId, shopName: p.shopName})}>
                            {p.image && <img alt="" src={p.image} loading="lazy" style={{width:32,height:32,objectFit:'cover'}}/>}<span style={{flex:1}}>{p.name}</span><span>{formatMoneyVND(p.price)}<div style={{color:'#64748b'}}>{num(p.sales)} bán</div></span>
                        </div>)}</div>
                    </div>}
                </section>}
            </div>
        </Card>
    </Page>;
}
