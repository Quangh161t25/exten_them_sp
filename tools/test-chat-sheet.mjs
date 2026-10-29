import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../shared/chat-sheet.js';
const S=globalThis.AutoChatSheet, session={shopId:123,userId:9,token:'TEST'};
const state={conversations:{},messages:{},pending:[]};
const conv={id:1,to_id:2,to_name:'Khách A',latest_message_id:3,last_message_time:new Date(Date.now()-3600000).toISOString(),latest_message_content:{text:'Khách hỏi'},latest_message_type:'text',latest_message_from_id:2};
S.applyPage(state,[conv],session,{}, {},1);assert.equal(state.conversations['1'].autoAt,0);
S.addMessages(state,'1',[{id:3,from_id:2,type:'text',content:{text:'<script>nội dung</script>'},created_timestamp:1700000000},{id:4,from_id:9,type:'text',content:{text:'Trả lời tay'},created_timestamp:1700000001}],session,{},1);
assert.equal(state.messages['1']['4'].auto,false);
S.applyPage(state,[conv],session,{'1':{at:15,messageId:4}}, {},2);assert.equal(state.conversations['1'].autoAt,15);
assert.equal(S.addMessages(state,'1',[{id:4,from_id:9,type:'text',content:{text:'Trả lời'},created_timestamp:1700000001}],session,{'1':{messageId:4}},2),0);assert.equal(state.messages['1']['4'].auto,true);
S.applyPage(state,[{...conv,id:6,to_name:'Khách A'}],session,{}, {},3);assert.equal(state.conversations['6'].autoAt,0);
const table=S.tables(state,session,'BCE',10);assert.equal(table.customers[0][6],'Đã tự chat');assert.equal(table.customers[1][5],'Chưa tự chat');assert.equal(table.messages.length,2);
assert.throws(()=>S.mergeShop([['sai']],S.CUSTOMER_HEADERS,[],123));
const old=[S.CUSTOMER_HEADERS,['OTHER','99','old']];assert.equal(S.mergeShop(old,S.CUSTOMER_HEADERS,table.customers,123)[1][1],'99');
// Workflow mock: 55 khách, không giới hạn vào 50 khách đầu, đồng bộ hoàn toàn chỉ đọc.
const store={'tcdd-shop-code':'BCE'}, sheetValues={}, calls=[];
const convs=Array.from({length:55},(_,i)=>({...conv,id:i+1,to_id:i+100,to_name:'Khách '+i}));
const ctx=vm.createContext({console,Date,Set,Map,Object,Array,JSON,String,Number,Promise,importScripts:()=>{},AutoChatSheet:S,SHARED_GOOGLE_CONFIG:{webSpreadsheetId:'WEB'},chrome:{storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(store[k])])),set:async patch=>{Object.assign(store,structuredClone(patch));}}},alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},runtime:{onMessage:{addListener:()=>{}}}},AUTOCHAT:{getSession:async()=>session,getQueue:async()=>({})},AUTOCHAT_ENGINE:{syncSessionFromTab:async()=>session,readConversationsPage:async(s,offset)=>{calls.push(['convs',offset]);return convs.slice(offset,offset+50);},readMessagesPage:async(s,id,offset)=>offset?[]:[{id:'m'+id,from_id:100,type:'text',content:{text:'Hội thoại '+id},created_timestamp:1700000000}]},getGoogleAccessToken:async()=>'TEST',ensureSheetExists:async title=>title,fetchSheetValues:async range=>sheetValues[range]||[],fetchSpreadsheetMetadata:async()=>({sheets:[{properties:{title:S.CUSTOMER_TITLE,sheetId:1,gridProperties:{rowCount:1000}}},{properties:{title:S.MESSAGE_TITLE,sheetId:2,gridProperties:{rowCount:1000}}}]}),fetchJsonWithTimeout:async(url,opts)=>{const req=JSON.parse(opts.body);assert.equal(req.requests.filter(r=>r.updateCells).length,2);return {res:{ok:true},data:{}};}});
ctx.self=ctx;
vm.runInContext(fs.readFileSync(new URL('../extension/autochat/sheet-sync.js',import.meta.url),'utf8'),ctx);
for(let i=0;i<12;i++){const result=await ctx.AUTOCHAT_SHEET_SYNC.sync();assert.equal(result.ok,true);}
const archive=store.autochat_export_123;
assert.equal(Object.keys(archive.conversations).length,55);assert.equal(Object.keys(archive.messages).length,55);assert.equal(archive.pending.length,0);assert.equal(archive.indexDone,true);assert.ok(calls.some(c=>c[1]===50));
console.log('PASS: phân trang >50 khách, lịch sử hai chiều, trạng thái chỉ gửi thành công, không nhầm khách cùng tên, không trùng tin, giữ gian khác, cập nhật hai sheet cùng batch, luồng đồng bộ không có API gửi tin.');

// API lặp trang: không đánh dấu đủ khách, giữ khách đã thu thập và báo lỗi rõ.
store.autochat_export_123.offset=50;store.autochat_export_123.indexDone=false;
store.autochat_export_123.pageFingerprint=convs.slice(0,50).map(c=>c.id).join('|');
ctx.AUTOCHAT_ENGINE.readConversationsPage=async()=>convs.slice(0,50);
let repeated=await ctx.AUTOCHAT_SHEET_SYNC.sync();assert.equal(repeated.indexDone,false);assert.match(repeated.error,/lặp trang/);
// Một hội thoại lỗi không chặn dữ liệu hội thoại khác hoặc mất bản đã lưu.
store.autochat_export_123.pending=['1','2'];store.autochat_export_123.conversations['1'].historyDone=false;store.autochat_export_123.conversations['2'].historyDone=false;
ctx.AUTOCHAT_ENGINE.readMessagesPage=async(s,id)=>{if(id==='1')throw new Error('Lỗi đọc tin');return [{id:'new',from_id:9,type:'text',content:{text:'Tin mới'},created_timestamp:1700000010}];};
await ctx.AUTOCHAT_SHEET_SYNC.sync();assert.equal(store.autochat_export_123.conversations['2'].historyDone,true);assert.equal(store.autochat_export_123.conversations['1'].historyDone,false);assert.ok(store.autochat_export_123.messages['1']);
console.log('PASS: Shopee lặp trang không báo đủ khách; một khách lỗi không chặn lịch sử khách khác.');

S.addMessages(state,'1',[{id:4,from_id:9,type:'text',content:{text:'Trả lời'},created_timestamp:1700000001}],session,{'1':{messageId:999}},3);assert.equal(state.messages['1']['4'].auto,true);
console.log('PASS: giữ nhãn Auto Chat của tin cũ sau khi có lần tự gửi mới.');

// Chỉ giữ khách có tin trong 7 ngày: khách cũ không vào sheet, khách quá hạn bị xoá khỏi bản lưu.
const fresh={conversations:{},messages:{},pending:[]}, now=Date.now();
S.applyPage(fresh,[{...conv,id:70,last_message_time:new Date(now-8*86400000).toISOString()},{...conv,id:71}],session,{},{},now);
assert.deepEqual(Object.keys(fresh.conversations),['71']);
fresh.conversations['71'].lastAt=now-8*86400000;fresh.messages['71']={x:{}};
S.prune(fresh,now);assert.equal(Object.keys(fresh.conversations).length,0);assert.equal(fresh.pending.length,0);assert.ok(!fresh.messages['71']);
console.log('PASS: chỉ đồng bộ khách nhắn tin trong 7 ngày, khách quá 7 ngày bị xoá.');
