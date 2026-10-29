import React from 'react';

// Nhóm nút lọc chọn một: options là [[value, label], ...].
export default function ChipGroup({label, value, onChange, options}) {
    return <div role="group" aria-label={label} style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
        {label && <span style={{fontSize:12,color:'#64748b',marginRight:2}}>{label}:</span>}
        {options.map(([v, text]) => {
            const on = v === value;
            return <button key={String(v)} type="button" aria-pressed={on} onClick={() => onChange(v)}
                style={{padding:'6px 10px',borderRadius:999,fontSize:12,cursor:'pointer',border:`1px solid ${on ? '#4f46e5' : '#cbd5e1'}`,background:on ? '#4f46e5' : '#fff',color:on ? '#fff' : '#334155',fontWeight:on ? 600 : 400}}>{text}</button>;
        })}
    </div>;
}
