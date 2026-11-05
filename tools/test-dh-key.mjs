// Ghi DH theo khóa: có thì ghi đè, chưa có thì thêm, không đổi thì bỏ qua, không xóa dòng.  node tools/test-dh-key.mjs
import assert from 'node:assert/strict';
import {HEADERS,KEY_COLS,keyPlan,withKeys} from '../shared/dh-sheet.js';
const row=(o)=>({gian:'BCE',mdh:'M1',item_id:'10',model_id:'20',trang_thai:'Đang giao',chi_tiet_dong_bo:'Chi tiết: đã tải',...o});
const cols=(rows)=>Object.fromEntries(KEY_COLS.map(h=>[h,rows.map(r=>r[h]??'')]));
const first=withKeys([row()]);
assert.equal(first[0].khoa,'BCE|M1|10-20|1');
// Sheet có 1 dòng đã có khóa; thêm dòng chưa có khóa (cũ) của M2 và dòng rất cũ không có item_id của M3
const sheet=[first[0],{gian:'BCE',mdh:'M2',item_id:'11',model_id:'0'},{gian:'BCE',mdh:'M3'}];
let p=keyPlan(HEADERS,cols(sheet),[row()]);
assert.deepEqual([p.appended,p.updated,p.unchanged],[0,0,1],'không đổi thì bỏ qua');
p=keyPlan(HEADERS,cols(sheet),[row({trang_thai:'Đã giao'})]);
assert.deepEqual(p.updates.map(u=>u.row),[1],'đổi thì ghi đè đúng dòng');
p=keyPlan(HEADERS,cols(sheet),[row({mdh:'M2',item_id:'11',model_id:'0'})]);
assert.deepEqual(p.updates.map(u=>u.row),[2],'dòng cũ chưa có khóa vẫn khớp, được ghi thêm khóa');
p=keyPlan(HEADERS,cols(sheet),[row({mdh:'M3'})]);
assert.deepEqual(p.updates.map(u=>u.row),[3],'dòng rất cũ không có item_id ghép theo đơn');
p=keyPlan(HEADERS,cols(sheet),[row({mdh:'M9'})]);
assert.deepEqual([p.appended,p.updates[0].row],[1,4],'đơn mới thêm vào cuối');
p=keyPlan(HEADERS,cols(sheet),[row({trang_thai:'Đã giao',ghi_chu:''})]);
assert.ok(!Object.hasOwn(p.updates[0].data,'ghi_chu'),'không ghi ô rỗng đè dữ liệu');
assert.ok(p.updates.every(u=>!u.clear));
console.log('PASS: DH ghi theo khóa');
