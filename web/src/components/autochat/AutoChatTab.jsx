import React,{useState,useEffect,useRef,useCallback,useMemo} from 'react';
import {RefreshCw,Store,Timer} from 'lucide-react';
import {fetchChatSheet} from '../../services/chatSheet.js';
import {Page,Crumbs,Tabs,Card,Toolbar,FilterBar,Grow,SearchBox,Dropdown,Option,SelectFilter,Pager} from '../common/PageShell.jsx';
const date=v=>v?new Date(v).toLocaleString('vi-VN'):'';
// Người chat cuối: tin cuối của shop do Auto Chat gửi thì ghi rõ.
const lastSender=(r,list)=>{const m=list[list.length-1];return r.lastFrom==='Shop'&&m?.from==='Shop'&&m.auto?'Shop (Auto Chat)':r.lastFrom||'';};
export default function AutoChatTab(){
 const [data,setData]=useState({rows:[],history:new Map(),progress:[],at:0}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [query,setQuery]=useState(''),[code,setCode]=useState(''),[selected,setSelected]=useState(''),[seconds,setSeconds]=useState(300),[who,setWho]=useState(''),[page,setPage]=useState(1),[size,setSize]=useState(20);
 const alive=useRef(false),busy=useRef(false),bottom=useRef(null);
 const refresh=useCallback(async()=>{if(busy.current)return;busy.current=true;setLoading(true);try{const result=await fetchChatSheet();if(alive.current){setData(result);setError('');}}catch(e){if(alive.current)setError(e.message);}finally{busy.current=false;if(alive.current)setLoading(false);}},[]);
 useEffect(()=>{alive.current=true;refresh();return()=>{alive.current=false;};},[refresh]);
 useEffect(()=>{if(!seconds)return;const t=setInterval(()=>{if(!document.hidden)refresh();},seconds*1000);return()=>clearInterval(t);},[seconds,refresh]);
 useEffect(()=>setPage(1),[query,code,who,size]);
 const base=useMemo(()=>{const q=query.trim().toLocaleLowerCase('vi-VN');return data.rows.filter(r=>(!code||r.code===code)&&(!q||[r.name,r.buyerId,r.convId,r.lastText,...(data.history.get(r.key)||[]).map(m=>m.text)].join(' ').toLocaleLowerCase('vi-VN').includes(q))).sort((a,b)=>b.lastAt-a.lastAt);},[data,query,code]);
 const whoOf=useCallback(r=>lastSender(r,data.history.get(r.key)||[]),[data]);
 const filtered=useMemo(()=>base.filter(r=>!who||whoOf(r)===who),[base,who,whoOf]);
 const visible=filtered.slice((page-1)*size,page*size);
 const active=filtered.find(r=>r.key===selected)||visible[0];
 const history=active?(data.history.get(active.key)||[]):[];
 useEffect(()=>{const el=bottom.current;if(el)el.scrollTop=el.scrollHeight;},[active?.key,history.length]);
 const count=v=>base.filter(r=>whoOf(r)===v).length;
 return <Page>
  <Crumbs group="Chăm sóc khách" title="Auto Chat" right={loading?'Đang tải…':`Đồng bộ: ${date(data.at)||'chưa có dữ liệu'}`}/>
  <Tabs label="Người chat cuối" value={who} onChange={setWho} tabs={[['','Tất cả',base.length],['Khách','Khách nhắn cuối',count('Khách')],['Shop','Shop nhắn cuối',count('Shop')],['Shop (Auto Chat)','Auto Chat nhắn cuối',count('Shop (Auto Chat)')]]}/>
  <Card>
   <Toolbar>
    <SearchBox value={query} onChange={setQuery} placeholder="Tìm khách hoặc nội dung hội thoại…"/>
    <Grow/>
    <Dropdown icon={Timer} label={seconds?`Tự làm mới ${seconds}s`:'Tắt tự làm mới'} align="right"><Option on={!seconds} onClick={()=>setSeconds(0)}>Tắt tự làm mới</Option>{[30,60,120,300].map(n=><Option key={n} on={seconds===n} onClick={()=>setSeconds(n)}>Mỗi {n} giây</Option>)}</Dropdown>
    <button className="dh-primary" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading?'dh-spin':''}/>Làm mới</button>
   </Toolbar>
   <FilterBar>
    <SelectFilter icon={Store} name="Gian" value={code} onChange={setCode} options={[...new Set(data.rows.map(r=>r.code))].sort().map(c=>[c,c])} allLabel="Tất cả gian"/>
    <Grow/>
    <span className="dh-sum">Khách có tin nhắn trong 7 ngày{data.progress.filter(p=>!code||p.code===code).map(p=><span key={p.code}> · {p.code}: {p.text}</span>)}</span>
   </FilterBar>
   {error&&<div role="alert" className="dh-error">Không đọc được dữ liệu: {error}. Giữ lại dữ liệu đang xem.</div>}
   <div style={{display:'flex',minHeight:0,flexWrap:'wrap'}}>
    <div className="dh-scroll dh-list" style={{flex:'1 1 560px',minWidth:0}}><table style={{minWidth:700}}><thead><tr>{['Gian','Khách hàng','Người chat cuối','Tin gần nhất','Lịch sử'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
     {visible.map(r=>{const w=whoOf(r);return <tr key={r.key} onClick={()=>setSelected(r.key)} className={active?.key===r.key?'sel':''} style={{cursor:'pointer'}}><td><span className="dh-shop">{r.code}</span></td><td><span className="dh-order-link">{r.name||r.buyerId}</span><small>{date(r.lastAt)}</small></td><td><span className={`dh-badge ${w==='Khách'?'orange':'green'}`}>{w}</span></td><td style={{maxWidth:340}}><div className="dh-cell" style={{whiteSpace:'pre-wrap'}}>{r.lastText}</div></td><td><small>{r.history}</small></td></tr>;})}
     {!filtered.length&&<tr><td colSpan={5} className="dh-empty">{loading?'Đang tải…':'Chưa có khách nhắn tin trong 7 ngày. Mở Auto Chat trong extension → Đồng bộ khách & hội thoại lên Sheet.'}</td></tr>}
    </tbody></table></div>
    <section style={{flex:'1 1 320px',minWidth:0,borderLeft:'1px solid #eef1f6',padding:14,display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 290px)'}}>
     <b>{active?`Hội thoại · ${active.name||active.buyerId}`:'Nội dung hội thoại'}</b>
     {active&&<small style={{color:'#64748b',marginTop:4}}>{active.code} · {active.history} · {history.length} tin</small>}
     <div ref={bottom} style={{flex:1,minHeight:120,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingTop:12}}>
      {history.map(m=><div key={m.id} style={{alignSelf:m.from==='Shop'?'flex-end':'flex-start',maxWidth:'90%',borderRadius:10,padding:10,background:m.from==='Shop'?'#eef2ff':'#f1f5f9'}}><div style={{fontSize:11,color:'#64748b'}}>{m.from}{m.auto?' · Auto Chat':''} · {date(m.at)}</div><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:13,marginTop:4}}>{m.text}</div></div>)}
      {!history.length&&<p style={{fontSize:12,color:'#64748b'}}>{active?'Lịch sử đang được đồng bộ từ Shopee.':'Chọn một khách để xem nội dung trao đổi.'}</p>}
     </div>
    </section>
   </div>
   <Pager page={page} total={filtered.length} size={size} onPage={setPage} onSize={setSize}/>
  </Card>
 </Page>;
}
