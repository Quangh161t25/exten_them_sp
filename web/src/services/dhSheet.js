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

export async function updateDhOrder(order, updates, headers) {
  const token = await getAccessToken();
  let currentHeaders = headers;
  if (!currentHeaders || !currentHeaders.length) {
    const [h = []] = await read("'DH'!1:1");
    currentHeaders = h;
  }

  const rows = (order.items && order.items.length)
    ? [...new Set(order.items.map(it => it.sheetRow || order.sheetRow).filter(Boolean))]
    : [order.sheetRow].filter(Boolean);

  if (!rows.length) {
    throw new Error('Không xác định được số dòng của đơn trong sheet DH');
  }

  let fieldCols = {};
  for (const key of Object.keys(updates)) {
    let idx = currentHeaders.indexOf(key);
    if (idx >= 0) {
      fieldCols[key] = column(idx);
    }
  }

  const missingKeys = Object.keys(updates).filter(k => !fieldCols[k]);
  if (missingKeys.length > 0) {
    const [freshHeaders = []] = await read("'DH'!1:1");
    currentHeaders = freshHeaders;
    for (const key of missingKeys) {
      const idx = currentHeaders.indexOf(key);
      if (idx >= 0) {
        fieldCols[key] = column(idx);
      }
    }
  }

  const data = [];
  for (const row of rows) {
    for (const [key, val] of Object.entries(updates)) {
      const colLetter = fieldCols[key];
      if (colLetter) {
        data.push({
          range: `'DH'!${colLetter}${row}`,
          values: [[val === null || val === undefined ? '' : String(val)]]
        });
      }
    }
  }

  if (!data.length) {
    throw new Error('Không tìm thấy cột tương ứng trong sheet DH để lưu');
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data
    })
  });

  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.error?.message || 'Lỗi khi cập nhật dữ liệu đơn vào sheet DH');
  }

  return resData;
}
