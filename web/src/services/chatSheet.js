import '../../../shared/chat-sheet.js';
import { CONFIG } from '../config/sheetsConfig.js';
import { getAccessToken } from './googleAuth.js';
import { callExtension } from './shopeeLiveOrders.js';
// Gửi tin tay cho khách qua extension (máy phải đang đăng nhập Shopee đúng shop của khách).
export async function sendChatText(row, text) {
    const res=await callExtension({type:'autochat-send-text',shopId:row.shopId,convId:row.convId,buyerId:row.buyerId,name:row.name,text});
    if(!res?.ok)throw new Error(res?.error || 'Không gửi được tin');
    return res;
}
export async function fetchChatSheet() {
    const S=globalThis.AutoChatSheet, token=await getAccessToken();
    const qs=new URLSearchParams();qs.append('ranges',`'${S.CUSTOMER_TITLE}'!A:M`);qs.append('ranges',`'${S.MESSAGE_TITLE}'!A:J`);
    const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchGet?${qs}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const data=await res.json();if(!res.ok)throw new Error(data.error?.message || 'Không đọc được sheet chat');
    const [customers=[],messages=[]]=(data.valueRanges || []).map(v=>v.values || []);
    for(const [rows,headers] of [[customers,S.CUSTOMER_HEADERS],[messages,S.MESSAGE_HEADERS]]) if(rows.length&&JSON.stringify(rows[0])!==JSON.stringify(headers))throw new Error('Cấu trúc cột sheet chat không khớp');
    const progress=customers.slice(1).filter(r=>r[2]==='__SYNC__').map(r=>({code:r[0],text:r[11],at:Number(r[12])||0}));
    const since=Date.now()-S.KEEP_MS;
    const rows=customers.slice(1).filter(r=>r[2]!=='__SYNC__'&&(Number(r[10])||0)>=since).map(r=>({key:JSON.stringify([r[1],r[2]]),code:r[0],shopId:String(r[1]),convId:String(r[2]),buyerId:r[3],name:r[4],sent:!!r[6],sentAt:Number(r[7])||0,lastText:r[8],lastFrom:r[9],lastAt:Number(r[10])||0,history:r[11],at:Number(r[12])||0}));
    const history=new Map();
    for(const m of messages.slice(1)){const key=JSON.stringify([m[1],m[2]]);if(!history.has(key))history.set(key,[]);history.get(key).push({id:m[3],at:Number(m[4])||0,from:m[5],type:m[6],text:m[7],auto:!!m[8]});}
    for(const list of history.values())list.sort((a,b)=>a.at-b.at);
    return {rows,history,progress,at:customers.slice(1).reduce((at,r)=>Math.max(at,Number(r[12])||0),0)};
}
