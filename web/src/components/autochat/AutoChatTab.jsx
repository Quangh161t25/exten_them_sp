import React,{useState,useEffect,useRef,useCallback,useMemo} from 'react';
import {fetchChatSheet} from '../../services/chatSheet.js';
import ChipGroup from '../common/ChipGroup.jsx';
const date=v=>v?new Date(v).toLocaleString('vi-VN'):'';
const input={padding:'8px 10px',border:'1px solid #cbd5e1',borderRadius:7,background:'#fff',fontSize:12};
const cell={padding:'10px',borderBottom:'1px solid #e2e8f0',fontSize:12,verticalAlign:'top',textAlign:'left'};
// Người chat cuối: tin cuối của shop do Auto Chat gửi thì ghi rõ.
const lastSender=(r,list)=>{const m=list[list.length-1];return r.lastFrom==='Shop'&&m?.from==='Shop'&&m.auto?'Shop (Auto Chat)':r.lastFrom||'';};
export default function AutoChatTab(){
 const [data,setData]=useState({rows:[],history:new Map(),progress:[],at:0}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [query,setQuery]=useState(''),[code,setCode]=useState(''),[selected,setSelected]=useState(''),[seconds,setSeconds]=useState(300),[who,setWho]=useState('');
 const alive=useRef(false),busy=useRef(false),bottom=useRef(null);
 const refresh=useCallback(async()=>{if(busy.current)return;busy.current=true;setLoading(true);try{const result=await fetchChatSheet();if(alive.current){setData(result);setError('');}}catch(e){if(alive.current)setError(e.message);}finally{busy.current=false;if(alive.current)setLoading(false);}},[]);
 useEffect(()=>{alive.current=true;refresh();return()=>{alive.current=false;};},[refresh]);
 useEffect(()=>{if(!seconds)return;const t=setInterval(()=>{if(!document.hidden)refresh();},seconds*1000);return()=>clearInterval(t);},[seconds,refresh]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase('vi-VN');return data.rows.filter(r=>(!code||r.code===code)&&(!who||lastSender(r,data.history.get(r.key)||[])===who)&&(!q||[r.name,r.buyerId,r.convId,r.lastText,...(data.history.get(r.key)||[]).map(m=>m.text)].join(' ').toLocaleLowerCase('vi-VN').includes(q))).sort((a,b)=>b.lastAt-a.lastAt);},[data,query,code,who]);
 const active=filtered.find(r=>r.key===selected)||filtered[0];
 const history=active?(data.history.get(active.key)||[]):[];
 useEffect(()=>{const el=bottom.current;if(el)el.scrollTop=el.scrollHeight;},[active?.key,history.length]);
 return <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
  <div style={{padding:12,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>AUTO CHAT</b>
   <input style={{...input,flex:1,minWidth:180}} placeholder="Tìm khách hoặc nội dung hội thoại..." aria-label="Tìm khách" value={query} onChange={e=>setQuery(e.target.value)}/>
   <button style={input} disabled={loading} onClick={refresh}>{loading?'Đang tải…':'Làm mới'}</button>
   <select style={input} aria-label="Tự động làm mới" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value={0}>Tắt tự làm mới</option>{[30,60,120,300].map(n=><option key={n} value={n}>Làm mới mỗi {n} giây</option>)}</select>
  </div>
  <div style={{display:'flex',gap:16,flexWrap:'wrap',padding:'10px 12px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8}}>
   <ChipGroup label="Gian" value={code} onChange={setCode} options={[['','Tất cả'],...[...new Set(data.rows.map(r=>r.code))].sort().map(c=>[c,c])]}/>
   <ChipGroup label="Người chat cuối" value={who} onChange={setWho} options={[['','Tất cả'],['Khách','Khách'],['Shop','Shop'],['Shop (Auto Chat)','Shop (Auto Chat)']]}/>
  </div>
  <div style={{fontSize:12,color:'#64748b'}}>Google Sheets · AUTO_CHAT / NOI_DUNG_CHAT · Khách có tin nhắn trong 7 ngày · Đồng bộ: {date(data.at)||'Chưa có dữ liệu'}{seconds?` · Làm mới mỗi ${seconds} giây`:' · Đã tắt tự làm mới'}</div>
  {data.progress.filter(p=>!code||p.code===code).map(p=><div key={p.code} style={{fontSize:12,color:'#475569'}}>{p.code}: {p.text}</div>)}
  {error&&<div role="alert" style={{padding:10,color:'#b91c1c',background:'#fef2f2'}}>Không đọc được dữ liệu: {error}. Giữ lại dữ liệu đang xem.</div>}
  <div style={{display:'flex',gap:18,flexWrap:'wrap',padding:12,background:'#fff',borderRadius:8}}><span><b>{filtered.length}</b> khách</span><span>Khách nhắn cuối: <b>{filtered.filter(r=>r.lastFrom==='Khách').length}</b></span></div>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
   <div style={{flex:'1 1 560px',overflowX:'auto',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,maxHeight:'70vh',overflowY:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',minWidth:760}}><thead><tr>{['Gian','Khách hàng','Người chat cuối','Tin gần nhất','Lịch sử'].map(h=><th key={h} style={{...cell,background:'#f8fafc',position:'sticky',top:0}}>{h}</th>)}</tr></thead><tbody>
    {filtered.map(r=>{const who=lastSender(r,data.history.get(r.key)||[]);return <tr key={r.key} onClick={()=>setSelected(r.key)} style={{background:active?.key===r.key?'#eff6ff':'#fff',cursor:'pointer'}}><td style={cell}>{r.code}</td><td style={cell}><span style={{color:'#2563eb',fontWeight:600}}>{r.name||r.buyerId}</span><div style={{color:'#94a3b8'}}>{date(r.lastAt)}</div></td><td style={{...cell,whiteSpace:'nowrap',fontWeight:600,color:who==='Khách'?'#b45309':'#15803d'}}>{who}</td><td style={{...cell,minWidth:240,maxWidth:340,overflowWrap:'anywhere'}}><div style={{display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden',whiteSpace:'pre-wrap'}}>{r.lastText}</div></td><td style={cell}>{r.history}</td></tr>;})}
    {!filtered.length&&<tr><td style={{...cell,padding:30,textAlign:'center'}} colSpan={5}>{loading?'Đang tải…':'Chưa có khách nhắn tin trong 7 ngày. Mở Auto Chat trong extension → Đồng bộ khách & hội thoại lên Sheet.'}</td></tr>}
   </tbody></table></div>
   <section style={{flex:'1 1 320px',minWidth:0,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:12,position:'sticky',top:12,display:'flex',flexDirection:'column',maxHeight:'75vh'}}>
    <b>{active?`Hội thoại · ${active.name||active.buyerId}`:'Nội dung hội thoại'}</b>
    {active&&<div style={{fontSize:11,color:'#64748b',marginTop:5}}>{active.code} · {active.history} · {history.length} tin</div>}
    <div ref={bottom} style={{flex:1,minHeight:120,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingTop:12}}>
     {history.map(m=><div key={m.id} style={{alignSelf:m.from==='Shop'?'flex-end':'flex-start',maxWidth:'90%',borderRadius:10,padding:10,background:m.from==='Shop'?'#eef2ff':'#f1f5f9'}}><div style={{fontSize:11,color:'#64748b'}}>{m.from}{m.auto?' · Auto Chat':''} · {date(m.at)}</div><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:13,marginTop:4}}>{m.text}</div></div>)}
     {!history.length&&<p style={{fontSize:12,color:'#64748b'}}>{active?'Lịch sử đang được đồng bộ từ Shopee.':'Chọn một khách để xem nội dung trao đổi.'}</p>}
    </div>
   </section>
  </div>
 </div>;
}
