// Chạy cùng writer của extension để bổ sung tiêu đề DH, không sửa các dòng đơn.
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {CONFIG} from '../web/src/config/sheetsConfig.js';
import {getAccessToken} from '../web/src/services/googleAuth.js';
import {HEADERS} from '../shared/dh-sheet.js';
const token=await getAccessToken(),base=`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}`;
async function json(url,options={}){const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}});const data=await res.json();return {res,data};}
async function meta(){const {res,data}=await json(base+'?fields=sheets.properties');if(!res.ok)throw new Error(data.error?.message);return data;}
const context={console,SHARED_GOOGLE_CONFIG:{webSpreadsheetId:CONFIG.spreadsheetId},getGoogleAccessToken:async()=>token,fetchJsonWithTimeout:json,fetchSpreadsheetMetadata:meta,
  fetchSheetValues:async range=>{const {res,data}=await json(base+'/values/'+encodeURIComponent(range));if(!res.ok)throw new Error(data.error?.message);return data.values||[];},
  ensureSheetExists:async()=>{let p=(await meta()).sheets.find(s=>s.properties.title.trim()==='DH');if(p)return p.properties.title;const {res,data}=await json(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title:'DH'}}}]})});if(!res.ok)throw new Error(data.error?.message);return 'DH';},
  chrome:{alarms:{create(){},onAlarm:{addListener(){}}},runtime:{onMessage:{addListener(){}}}}};
context.self=context;vm.createContext(context);
vm.runInContext(await fs.readFile(new URL('../extension/order-tool/dh-sync.bundle.js',import.meta.url),'utf8'),context);
await context.DHSheetSync.writeOrders([]);
const [headers]=await context.fetchSheetValues("'DH'!1:1");
if(HEADERS.some(h=>!headers.includes(h)))throw new Error('Thiếu cột sau khi khởi tạo');
console.log(`DH: đã xác minh ${headers.length} cột. Không thay đổi các dòng dữ liệu đơn hàng.`);
