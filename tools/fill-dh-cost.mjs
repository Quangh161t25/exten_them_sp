// Thêm 4 cột gia_sp, thanh_tien_sp, tong_thanh_tien_sp, loi_nhuan vào sheet DH (đúng vị trí theo shared/dh-sheet.js)
// rồi điền giá trị cho các dòng đã có, theo gia_ban của DS_SP. Không đụng các cột khác.
//   node tools/fill-dh-cost.mjs          -> xem trước, không ghi
//   node tools/fill-dh-cost.mjs --apply  -> chèn cột và ghi
import {CONFIG} from '../web/src/config/sheetsConfig.js';
import {getAccessToken} from '../web/src/services/googleAuth.js';
import {HEADERS} from '../shared/dh-sheet.js';
// list-finance.js gắn listener chrome khi nạp: giả chrome để dùng lại costMap
globalThis.chrome??={runtime:{onMessage:{addListener(){}}}};
const {costMap}=await import('../extension/order-tool/list-finance.js');

const NEW=['gia_sp','thanh_tien_sp','tong_thanh_tien_sp','loi_nhuan'];
const apply=process.argv.includes('--apply');
const dsId=process.argv.find(a=>a.startsWith('--ds='))?.slice(5)||CONFIG.spreadsheetId;
const token=await getAccessToken(),base=id=>`https://sheets.googleapis.com/v4/spreadsheets/${id}`;
async function call(url,options={}){const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});const data=await res.json();if(!res.ok)throw new Error(data.error?.message||res.status);return data;}
const letter=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const get=async(id,range)=>(await call(`${base(id)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`)).values||[];

const meta=await call(base(CONFIG.spreadsheetId)+'?fields=sheets.properties');
const props=meta.sheets.map(s=>s.properties).find(p=>p.title.trim()==='DH');
if(!props)throw new Error('Không có sheet DH');
let head=(await get(CONFIG.spreadsheetId,'DH!1:1'))[0]||[];
const prices=costMap(await get(dsId,'DS_SP!A:G'));
console.log(`DS_SP: ${prices.size} mã giá · DH: ${head.length} cột`);

// 1. Chèn cột còn thiếu ngay sau cột đứng trước nó trong HEADERS
const missing=NEW.filter(h=>!head.includes(h));
console.log(missing.length?'Cột sẽ thêm: '+missing.join(', '):'Đã có đủ 4 cột');
if(apply&&missing.length){
  for(const h of missing){
    let prev=HEADERS[HEADERS.indexOf(h)-1];const at=head.indexOf(prev)+1;
    if(at<=0)throw new Error('Không thấy cột '+prev);
    await call(base(CONFIG.spreadsheetId)+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
      {insertDimension:{range:{sheetId:props.sheetId,dimension:'COLUMNS',startIndex:at,endIndex:at+1},inheritFromBefore:true}},
      {updateCells:{start:{sheetId:props.sheetId,rowIndex:0,columnIndex:at},rows:[{values:[{userEnteredValue:{stringValue:h}}]}],fields:'userEnteredValue'}}]})});
    head.splice(at,0,h);
  }
  console.log('Đã chèn cột.');
}

// 1b. Cột đã có nhưng sai chỗ (Đồng bộ DH thêm vào cuối sheet): chuyển về ngay sau cột đứng trước
for(const h of NEW){
  const cur=head.indexOf(h),at=head.indexOf(HEADERS[HEADERS.indexOf(h)-1])+1;
  if(cur<0||at<=0||cur===at)continue;
  console.log(`Chuyển cột ${h}: ${letter(cur)} -> ${letter(at>cur?at-1:at)}`);
  if(!apply)continue;
  await call(base(CONFIG.spreadsheetId)+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
    {moveDimension:{source:{sheetId:props.sheetId,dimension:'COLUMNS',startIndex:cur,endIndex:cur+1},destinationIndex:at}}]})});
  head.splice(cur,1);head.splice(at>cur?at-1:at,0,h);
}

// 2. Tính giá trị từ sku, slg, doanh_thu (đơn = gian + mdh)
const need=['gian','mdh','sku','sku_san_pham','slg','doanh_thu'];
const col=h=>{const i=head.indexOf(h);if(i<0)throw new Error('DH thiếu cột '+h);return i;};
const cols=Object.fromEntries(need.map(h=>[h,(()=>{try{return col(h);}catch{return -1;}})()]));
if(cols.mdh<0||cols.sku<0||cols.slg<0)throw new Error('DH thiếu cột mdh/sku/slg');
const data=await Promise.all(need.map(h=>cols[h]<0?[]:get(CONFIG.spreadsheetId,`DH!${letter(cols[h])}2:${letter(cols[h])}`).then(v=>v.map(r=>r[0]??''))));
const rows=Math.max(...data.map(c=>c.length));
const rec=Array.from({length:rows},(_,i)=>Object.fromEntries(need.map((h,j)=>[h,data[j][i]??''])));
const cost=r=>{const k=String(r.sku||r.sku_san_pham||'').trim().toUpperCase();if(!k)return null;const v=prices.get(k)??prices.get(k.slice(0,10));return v==null?null:v;};
const groups=new Map();
rec.forEach((r,i)=>{if(!r.mdh)return;const k=r.gian+'|'+r.mdh;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
const out=rec.map(()=>['','','','']);let priced=0,profit=0;
for(const idx of groups.values()){
  let sum=0,all=true;
  for(const i of idx){const p=cost(rec[i]),q=Number(rec[i].slg);if(p==null||!(q>0)){all=false;continue;}out[i][0]=p;out[i][1]=p*q;sum+=p*q;priced++;}
  if(all){const first=idx[0];out[first][2]=sum;const dt=rec[first].doanh_thu;if(dt!==''&&Number.isFinite(Number(dt))){out[first][3]=Number(dt)-sum;profit++;}}
}
console.log(`${rows} dòng · ${groups.size} đơn · ${priced} dòng có Giá SP · ${profit} đơn có Lợi nhuận`);
if(!apply){console.log('Xem trước xong. Chạy lại với --apply để ghi.');process.exit(0);}

// 3. Ghi từng cột (các cột có thể không liền nhau)
const data2=NEW.map((h,j)=>({range:`DH!${letter(col(h))}2:${letter(col(h))}${rows+1}`,values:out.map(r=>[r[j]])}));
await call(`${base(CONFIG.spreadsheetId)}/values:batchUpdate`,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:data2})});
console.log('Đã ghi 4 cột vào DH.');
