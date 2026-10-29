import {CONFIG} from '../config/sheetsConfig.js';
import {getAccessToken} from './googleAuth.js';
import {parseSheet,RAW_HEADERS} from '../../../shared/dh-sheet.js';
export function column(index){let out='';for(let n=index+1;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
async function read(range){
  const token=await getAccessToken();
  const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(30000)});
  const data=await res.json();if(!res.ok)throw new Error(data.error?.message||'Không đọc được DH');return data.values||[];
}
export async function fetchDhSheet(){
  const [headers=[]]=await read("'DH'!1:1");
  // Danh sách không tải các ô JSON lớn; chỉ lấy khi mở chi tiết gốc.
  const last=headers.reduce((n,h,i)=>RAW_HEADERS.includes(h)?n:Math.max(n,i),0);
  const values=await read(`'DH'!A:${column(last)}`);
  return {orders:parseSheet(values),headers};
}
export async function fetchDhRaw(order,headers){
  const indices=RAW_HEADERS.map(h=>headers.indexOf(h)).filter(i=>i>=0);
  if(!indices.length)return null;
  const end=Math.max(...indices);
  const [row=[]]=await read(`'DH'!A${order.sheetRow}:${column(end)}${order.sheetRow}`);
  if(String(row[headers.indexOf('mdh')])!==String(order.mdh))throw new Error('Vị trí đơn đã thay đổi. Làm mới danh sách rồi mở lại chi tiết.');
  const raw=RAW_HEADERS.map(h=>row[headers.indexOf(h)]||'').join('');
  return raw?JSON.parse(raw):null;
}
