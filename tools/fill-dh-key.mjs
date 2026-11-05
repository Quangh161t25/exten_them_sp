// Điền cột khoa cho các dòng DH chưa có (dòng ghi trước khi đổi sang ghi theo khóa). Chỉ ghi cột khoa.
//   node tools/fill-dh-key.mjs          -> xem trước, không ghi
//   node tools/fill-dh-key.mjs --apply  -> ghi
import {CONFIG} from '../web/src/config/sheetsConfig.js';
import {getAccessToken} from '../web/src/services/googleAuth.js';

const apply=process.argv.includes('--apply'),id=CONFIG.spreadsheetId;
const token=await getAccessToken(),base=`https://sheets.googleapis.com/v4/spreadsheets/${id}`;
async function call(url,options={}){const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});const data=await res.json();if(!res.ok)throw new Error(data.error?.message||res.status);return data;}
const letter=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const head=(await call(`${base}/values/${encodeURIComponent('DH!1:1')}`)).values?.[0]||[];
const read=async h=>{const i=head.indexOf(h);if(i<0)return [];return ((await call(`${base}/values/${encodeURIComponent(`DH!${letter(i)}2:${letter(i)}`)}`)).values||[]).map(r=>r[0]??'');};
if(!head.includes('khoa'))throw new Error('DH chưa có cột khoa: chạy Đồng bộ DH một lần (extension đã Reload) để thêm cột');
const [gian,mdh,item,model,khoa]=await Promise.all(['gian','mdh','item_id','model_id','khoa'].map(read));
const n=Math.max(gian.length,mdh.length),count=new Map(),seen=new Set(khoa.filter(Boolean)),out=[];let fill=0;
for(let i=0;i<n;i++){
  let k=khoa[i]||'';
  if(!k&&mdh[i]){const b=[gian[i],mdh[i],`${item[i]||''}-${model[i]||''}`].join('|');let c=count.get(b)||0;do c++;while(seen.has(`${b}|${c}`));count.set(b,c);k=`${b}|${c}`;seen.add(k);fill++;}
  out.push([k]);
}
console.log(`DH: ${n} dòng · ${fill} dòng sẽ điền khoa`);
if(!apply||!fill){console.log(apply?'Không có gì để ghi.':'Xem trước xong. Chạy lại với --apply để ghi.');process.exit(0);}
const c=letter(head.indexOf('khoa'));
await call(`${base}/values/${encodeURIComponent(`DH!${c}2:${c}${n+1}`)}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({values:out})});
console.log('Đã điền khoa.');
