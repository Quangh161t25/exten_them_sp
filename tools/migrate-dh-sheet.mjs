// Chuyển sheet DH sang thứ tự cột mới (shared/dh-sheet.js), bỏ 10 cột cũ trống/trùng.
// Sao lưu sheet DH thành tab DH_BACKUP_<thời gian> trước khi ghi. Chạy lại nhiều lần không sao.
//   node tools/migrate-dh-sheet.mjs          -> xem trước, không ghi
//   node tools/migrate-dh-sheet.mjs --apply  -> sao lưu rồi ghi
import {CONFIG} from '../web/src/config/sheetsConfig.js';
import {getAccessToken} from '../web/src/services/googleAuth.js';
import {migrateValues,HEADERS} from '../shared/dh-sheet.js';

const apply=process.argv.includes('--apply');
const token=await getAccessToken(),base=`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}`;
async function call(url,options={}){const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});const data=await res.json();if(!res.ok)throw new Error(data.error?.message||res.status);return data;}
const meta=await call(base+'?fields=sheets.properties');
const props=meta.sheets.map(s=>s.properties).find(p=>p.title.trim()==='DH');
if(!props)throw new Error('Không có sheet DH');
const values=(await call(`${base}/values/${encodeURIComponent(`'${props.title}'!A:ZZ`)}?valueRenderOption=UNFORMATTED_VALUE`)).values||[];
const m=migrateValues(values);
const same=JSON.stringify(values[0]||[])===JSON.stringify(m.headers);
console.log(`DH: ${values.length-1} dòng · ${values[0]?.length||0} cột → ${m.headers.length} cột · bỏ: ${m.removed.join(', ')||'không có'}`);
console.log(`mdh ở cột ${String.fromCharCode(65+m.headers.indexOf('mdh'))}, mvd ở cột ${String.fromCharCode(65+m.headers.indexOf('mvd'))}`);
const extra=m.headers.filter(h=>!HEADERS.includes(h));if(extra.length)console.log('Giữ cột tự thêm:',extra.join(', '));
if(same){console.log('Sheet DH đã đúng thứ tự mới, không cần làm gì.');process.exit(0);}
if(!apply){console.log('Xem trước xong. Chạy lại với --apply để sao lưu và ghi.');process.exit(0);}

const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,13);
const backup=(await call(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{duplicateSheet:{sourceSheetId:props.sheetId,newSheetName:`DH_BACKUP_${stamp}`,insertSheetIndex:meta.sheets.length}}]})})).replies[0].duplicateSheet.properties;
console.log(`Đã sao lưu: tab ${backup.title}`);
const cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v??'')}});
const width=m.headers.length,grid=props.gridProperties;
const requests=[{updateCells:{start:{sheetId:props.sheetId,rowIndex:0,columnIndex:0},rows:[m.headers,...m.rows].map(r=>({values:r.map(cell)})),fields:'userEnteredValue'}}];
if(grid.columnCount>width)requests.push({deleteDimension:{range:{sheetId:props.sheetId,dimension:'COLUMNS',startIndex:width,endIndex:grid.columnCount}}});
await call(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
const check=(await call(`${base}/values/${encodeURIComponent(`'${props.title}'!A:ZZ`)}?valueRenderOption=UNFORMATTED_VALUE`)).values||[];
const ok=JSON.stringify(check[0])===JSON.stringify(m.headers)&&check.length===values.length&&check.slice(1).every((r,i)=>m.headers.every((h,j)=>String(r[j]??'')===String(m.rows[i][j]??'')));
console.log(ok?`Đã chuyển đổi DH: ${check.length-1} dòng, ${width} cột, dữ liệu khớp từng ô.`:'CẢNH BÁO: đọc lại không khớp, kiểm tra tab sao lưu.');
if(!ok)process.exit(1);
