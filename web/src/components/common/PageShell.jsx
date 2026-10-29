// Khung giao diện chung cho các module (theo màn ĐH):
// 1 đường dẫn · 2 tab · 3 thanh tìm kiếm + công cụ · 4 hàng lọc · bảng + phân trang.
// CSS dùng chung nằm trong ../dh/orders.css (lớp dh-*).
import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,Home,Search,X} from 'lucide-react';
import '../dh/orders.css';

export function Page({children}){return <div className="dh-page">{children}</div>;}

export function Crumbs({group,title,right}){
  return <header className="dh-crumbs"><nav aria-label="Đường dẫn"><Home size={14}/><span>Trang chủ</span>{group&&<><ChevronRight size={13}/><span>{group}</span></>}<ChevronRight size={13}/><b>{title}</b></nav>{right!=null&&<span className="dh-sync">{right}</span>}</header>;
}

// tabs: [[value, label, count?], ...]
export function Tabs({tabs,value,onChange,label='Tab'}){
  return <nav className="dh-tabs" aria-label={label}>{tabs.map(([v,l,n])=><button key={String(v)} type="button" aria-pressed={value===v} className={value===v?'active':''} onClick={()=>onChange(v)}>{l}{n!=null&&<span>{n}</span>}</button>)}</nav>;
}

export function Card({children}){return <div className="dh-card">{children}</div>;}
export function Toolbar({children}){return <div className="dh-toolbar">{children}</div>;}
export function FilterBar({children}){return <div className="dh-filterbar">{children}</div>;}
export const Grow=()=><span className="dh-grow"/>;

export function SearchBox({value,onChange,placeholder='Tìm kiếm…'}){
  return <label className="dh-search"><Search size={15}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label="Xoá tìm kiếm" onClick={()=>onChange('')}><X size={13}/></button>}</label>;
}

// Ô lọc dạng nút + danh sách thả xuống (đóng khi bấm ra ngoài hoặc Esc).
export function Dropdown({icon:Icon,label,active,children,align='left'}){
  const [open,setOpen]=useState(false),ref=useRef(null);
  useEffect(()=>{if(!open)return;const out=e=>{if(!ref.current?.contains(e.target))setOpen(false);};const esc=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('mousedown',out);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('mousedown',out);document.removeEventListener('keydown',esc);};},[open]);
  return <div className="dh-dd" ref={ref}><button type="button" className={`dh-dd-btn${active?' on':''}`} aria-expanded={open} onClick={()=>setOpen(!open)}>{Icon&&<Icon size={14}/>}<span>{label}</span><ChevronDown size={14}/></button>{open&&<div className={`dh-dd-menu ${align}`} onClick={e=>{if(e.target.closest('[data-close]'))setOpen(false);}}>{children}</div>}</div>;
}
export const Option=({on,onClick,children})=><button type="button" data-close className={`dh-dd-opt${on?' on':''}`} onClick={onClick}>{children}{on&&<span>✓</span>}</button>;

// Dropdown chọn một giá trị từ options [[value,label],...]; value rỗng = tất cả.
export function SelectFilter({icon,name,value,onChange,options,allLabel='Tất cả'}){
  const cur=options.find(o=>o[0]===value);
  return <Dropdown icon={icon} label={value!==''&&cur?`${name}: ${cur[1]}`:name} active={value!==''}><Option on={value===''} onClick={()=>onChange('')}>{allLabel}</Option>{options.map(([v,l])=><Option key={String(v)} on={value===v} onClick={()=>onChange(v)}>{l}</Option>)}</Dropdown>;
}

export function Pager({page,total,size,onPage,onSize,sizes=[20,50,100]}){
  const pages=Math.max(1,Math.ceil(total/size)),cur=Math.min(page,pages),start=(cur-1)*size;
  return <footer className="dh-footer"><div className="dh-pagesize"><span>{total?`${start+1}–${Math.min(start+size,total)}`:'0'}/<i>Tổng:</i>{total.toLocaleString('vi-VN')}</span>{onSize&&<><select aria-label="Số dòng mỗi trang" value={size} onChange={e=>onSize(Number(e.target.value))}>{sizes.map(n=><option key={n} value={n}>{n}</option>)}</select><i>/ trang</i></>}</div>
    <div className="dh-pager"><button type="button" aria-label="Trang đầu" disabled={cur<=1} onClick={()=>onPage(1)}><ChevronsLeft size={14}/></button><button type="button" aria-label="Trang trước" disabled={cur<=1} onClick={()=>onPage(cur-1)}><ChevronLeft size={14}/></button><b>{cur}</b><span>/{pages}</span><button type="button" aria-label="Trang sau" disabled={cur>=pages} onClick={()=>onPage(cur+1)}><ChevronRight size={14}/></button><button type="button" aria-label="Trang cuối" disabled={cur>=pages} onClick={()=>onPage(pages)}><ChevronsRight size={14}/></button></div></footer>;
}
