import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {HEADERS,RAW_HEADERS,REMOVED_HEADERS,statusOf,recordsForOrder,mergePlan,parseSheet,migrateValues} from '../shared/dh-sheet.js';
// 27 cột của sheet DH đời cũ: dùng để thử ghi vào sheet chưa chuyển đổi.
const LEGACY_HEADERS=['gian','ngay','ngay_gio','mdh','mvd','tong_tien','ma_giam_gia','phi_vc','phu_phi','thue','doanh_thu','phi_khac','tien_sp','loi_nhuan','tinh_trang','trang_thai','sku','id_sp','slg','don_gia','thanh_tien','ten_khach','ng_nhan','dia_chi','link_don','mvd_huy','mdh_huy'];
import {findDeep} from '../extension/order-tool/orders.js';

for(const [input,expected]of [['Đã giao cho ĐVVC','Đang giao'],['Đã giao','Đã giao'],['Hoàn thành','Hoàn thành'],['Đã hủy','Đã hủy'],['Đã hoàn tiền','Hoàn tiền'],['Đang chuyển hoàn','Hoàn hàng'],['Trả hàng','Trả hàng'],['Trả hàng / Hoàn tiền','Trả hàng / Hoàn tiền']])assert.equal(statusOf(input),expected);
const sample={orderSn:'261030TEST',orderId:'1',status:'Đã hủy',orderDate:'30/10/2026',createTime:1793318400,items:[{itemId:1,modelId:2,name:'SP',model:'Đỏ',modelSku:'SKU',qty:2,price:10}],raw:{long:'x'.repeat(100000)},detail:{recipient_name:'Khách',phone:'0123456789'},income:{byField:{ESCROW_AMOUNT:0},rows:[]}};
const records=recordsForOrder(sample,{shopId:7},'BCE',findDeep);
assert.equal(records[0].doanh_thu,0);assert.equal(records[0].thanh_tien,20);assert.equal(records[0].sdt,'0123456789');
assert.equal(JSON.parse(RAW_HEADERS.map(h=>records[0][h]).join('')).card.long.length,100000);
const oldRow=LEGACY_HEADERS.map(h=>({gian:'BCE',mdh:'261030TEST',sku:'SKU',tien_sp:'=10*2',loi_nhuan:5})[h]??'');
const other=LEGACY_HEADERS.map(h=>({gian:'JOY',mdh:'261030TEST',sku:'SKU'})[h]??'');
const plan=mergePlan([LEGACY_HEADERS,oldRow,other],records);
assert.equal(plan.updates.length,1);assert.equal(plan.updates[0].row,1);assert.ok(!Object.hasOwn(plan.updates[0].data,'tien_sp'));assert.ok(!Object.hasOwn(plan.updates[0].data,'loi_nhuan'));
assert.deepEqual(plan.headers.slice(0,27),LEGACY_HEADERS);
assert.throws(()=>mergePlan([['unknown'],['x']],records),/thiếu/);
const grouped=parseSheet([HEADERS,...['BCE','JOY'].flatMap(gian=>[1,2].map(i=>HEADERS.map(h=>({...records[0],gian,shop_id:gian==='BCE'?'7':'8',model_id:String(i)})[h]??'')))]);
assert.equal(grouped.length,2);assert.equal(grouped[0].items.length,2);
console.log('PASS: trạng thái tách riêng, JSON không mất dữ liệu, giữ cột thủ công, không trộn gian, nhóm nhiều sản phẩm.');

// Chạy bundle worker thật với Shopee/Google giả lập; không gửi hoặc sửa đơn Shopee.
let now=Date.now(),requests=0,failWrite=false,failCard=false;
class Clock extends Date {static now(){return now;}}
const storage={'tcdd-shop-code':'BCE'},sheet=[[...LEGACY_HEADERS],other],props={sheetId:1,title:'DH',gridProperties:{rowCount:1000,columnCount:27}};
let listener;
const ctx={console,Date:Clock,URLSearchParams,setTimeout,clearTimeout,AbortSignal,
  SHARED_GOOGLE_CONFIG:{webSpreadsheetId:'test'},getGoogleAccessToken:async()=>'test',ensureSheetExists:async()=>'DH',fetchSpreadsheetMetadata:async()=>({sheets:[{properties:props}]}),
  fetchSheetValues:async range=>range.endsWith('1:1')?[sheet[0]]:structuredClone(sheet),
  fetchJsonWithTimeout:async(url,options)=>{
    if(failWrite)throw new Error('Google unavailable');
    for(const r of JSON.parse(options.body).requests){
      if(r.appendDimension){const k=r.appendDimension.dimension==='ROWS'?'rowCount':'columnCount';props.gridProperties[k]+=r.appendDimension.length;}
      if(r.updateCells){const u=r.updateCells,start=u.start||{rowIndex:u.range.startRowIndex,columnIndex:u.range.startColumnIndex};
        if(!u.rows){sheet[start.rowIndex]=[];continue;}
        u.rows.forEach((row,i)=>{sheet[start.rowIndex+i]??=[];row.values.forEach((c,j)=>sheet[start.rowIndex+i][start.columnIndex+j]=c.userEnteredValue?.stringValue??c.userEnteredValue?.numberValue??'');});
      }
    }
    return {res:{ok:true},data:{}};
  },
  chrome:{storage:{local:{get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(k=>[k,structuredClone(storage[k])])),set:async obj=>Object.assign(storage,structuredClone(obj))}},
    alarms:{create(){},onAlarm:{addListener(){}}},runtime:{onMessage:{addListener(fn){listener=fn;}}},
    cookies:{get:async()=>({value:'fake'})},tabs:{query:async()=>[{id:1,status:'complete',url:'https://banhang.shopee.vn/'}],get:async()=>({id:1,status:'complete',url:'https://banhang.shopee.vn/'}),onUpdated:{addListener(){},removeListener(){}}},
    scripting:{executeScript:async({args})=>{
      const [url,method,body]=args;requests++;
      assert.ok(!/batch_init|shipment|send_message/.test(url));
      let data;
      if(url.includes('shop_info'))data={shop_id:7,name:'Test'};
      else if(url.includes('search_order_list_index')){
        const {page_number:p,page_size:n}=body.pagination;
        data={index_list:Array.from({length:43},(_,i)=>({order_id:i+1})).slice((p-1)*n,p*n),pagination:{total:43,previous_page_sentinel:'page'+p}};
      }else if(url.includes('get_order_list_card_list')){
        data={card_list:body.order_param_list.filter((x,i)=>!failCard||i!==0).map(x=>({order_id:x.order_id,card_header:{order_sn:'261030TEST'+x.order_id,buyer_info:{username:'Khách'}},status_info:{status:x.order_id===1?'Đã hủy':'Đang giao'},items:[{item_id:x.order_id,model_id:2,product_name:'SP',model_name:'Đỏ',model_sku:'SKU'+x.order_id,amount:1,price:10000}]}))};
      }else if(url.includes('get_one_order'))data={recipient_name:'Khách nhận',phone:'0123456789'};
      else if(url.includes('get_order_income_components'))data={seller_income_breakdown:{breakdown:[{field_name:'ESCROW_AMOUNT',amount:900000000}]}};
      else throw new Error('Unexpected API '+url);
      return [{result:{status:200,text:JSON.stringify({data})}}];
    }}
  }
};ctx.self=ctx;
vm.createContext(ctx);vm.runInContext(await fs.readFile(new URL('../extension/order-tool/dh-sync.bundle.js',import.meta.url),'utf8'),ctx);
const sync=()=>new Promise(resolve=>listener({type:'dh-sync-sheet'},{},resolve));
failWrite=true;assert.equal((await sync()).ok,false);assert.equal(storage.dh_sync_7_BCE,undefined);failWrite=false;
failCard=true;assert.equal((await sync()).ok,false);assert.equal(storage.dh_sync_7_BCE,undefined);failCard=false;
for(let i=0;i<10;i++){now+=60000;assert.equal((await sync()).ok,true);}
assert.equal(storage.dh_sheet_meta.complete,true);assert.equal(storage.dh_sheet_meta.seen,43);
const orders=parseSheet(sheet);assert.equal(orders.filter(o=>o.gian==='BCE').length,43);assert.equal(orders.filter(o=>o.gian==='JOY').length,1);
assert.equal(orders.find(o=>o.mdh==='261030TEST1').status,'Đã hủy');
await sync();assert.equal(parseSheet(sheet).length,44);
console.log(`PASS: worker phân trang 43 đơn, upsert không trùng, giữ đơn hủy và gian khác, lỗi Google/thiếu card không bỏ qua trang (${requests} request giả lập).`);

// Chuyển đổi sheet cũ: bỏ 10 cột cũ, mdh ở D, mvd ở E, giữ cột lạ và mọi ô dữ liệu.
{
  const old=[[...LEGACY_HEADERS,'shop_id','cot_tu_them',...RAW_HEADERS],LEGACY_HEADERS.map(h=>({gian:'BCE',ngay:'30/10/2026',mdh:'M1',mvd:'V1',tong_tien:100,link_don:'x'})[h]??'').concat(['1','ghi tay','{"a"',':1}'])];
  const m=migrateValues(old);
  assert.equal(m.headers[3],'mdh');assert.equal(m.headers[4],'mvd');
  for(const h of REMOVED_HEADERS)assert.ok(!m.headers.includes(h));
  assert.ok(m.headers.includes('cot_tu_them'));assert.equal(m.headers.indexOf('cot_tu_them'),m.headers.indexOf(RAW_HEADERS[0])-1);
  const row=Object.fromEntries(m.headers.map((h,i)=>[h,m.rows[0][i]]));
  assert.equal(row.mdh,'M1');assert.equal(row.tong_tien,100);assert.equal(row.cot_tu_them,'ghi tay');assert.equal(row.du_lieu_goc_1+row.du_lieu_goc_2,'{"a":1}');
  const kept=old[1].filter(v=>v!==''&&v!=='30/10/2026'&&v!=='x').length;assert.equal(m.rows[0].filter(v=>v!=='').length,kept);
  // Cột cũ còn dữ liệu thật (vd giá vốn nhập tay) thì không tự xóa.
  const filled=structuredClone(old);filled[1][LEGACY_HEADERS.indexOf('tien_sp')]=5000;assert.throws(()=>migrateValues(filled),/tien_sp/);
  // Ghi đơn sau khi chuyển đổi: dùng đúng thứ tự cột mới, không thêm lại cột cũ.
  assert.deepEqual(mergePlan([m.headers,...m.rows],[]).headers,m.headers);
}
console.log('PASS: chuyển đổi DH bỏ 10 cột cũ, mdh cột D, giữ cột tự thêm và dữ liệu gốc, chặn xóa cột còn dữ liệu.');
