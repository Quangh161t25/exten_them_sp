// Kiểm tra chuyển dữ liệu Hàng hoàn API -> dòng Sheet và so sánh thêm / cập nhật / bỏ qua.  node tools/test-hh-api.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(fs.readFileSync(new URL('../extension/hh-api/returns.js', import.meta.url), 'utf8'));
const { HEADERS, caseToRows, diffRows, sheetRecords, caseId } = globalThis.HHReturns;

const sample = {
  entity_type: 2, entity_id_str: '2-111', order_id: 999, return_id: 111, order_sn: '2611ABC', return_sn: '2611R1',
  buyer: { name: 'khach1' }, request_reason_text: 'Hàng lỗi', request_solution_text: 'Trả hàng và hoàn tiền', display_refund_amount: '₫120.000',
  header: { status_text: 'Đang trả hàng', hint_text: 'Chờ người mua gửi hàng' },
  product_items: [
    { amount: 1, product: { id: 10, name: 'Nồi cơm', sku: 'P1' }, model: { id: 20, name: 'Trắng', sku: 'P1-WH' } },
    { amount: 2, product: { id: 11, name: 'Nắp', sku: 'P2' }, model: { id: 0, name: '', sku: '' } }
  ],
  forward_logistics_info: { tracking_numbers: ['SPX1'], shipping_carrier: 'SPX', aggregated_logistics_status_text: 'Đã giao', latest_logistics_status_update_time: 1793600000 },
  reverse_logistics_info: { tracking_numbers: [], shipping_carrier: '', aggregated_logistics_status_text: '', latest_logistics_status_update_time: 0 }
};
const col = (h) => HEADERS.indexOf(h);
const rows = caseToRows(sample, { code: 'GDD', shopId: 7, syncedAt: 'lan1' });
assert.equal(rows.length, 2, 'mỗi sản phẩm một dòng');
assert.equal(rows[0].length, HEADERS.length);
assert.deepEqual(HEADERS.slice(-3), ['Khóa', 'Ngày đặt đơn', 'Ngày hoàn hàng'], 'cột mới thêm ở cuối để sheet cũ không lệch cột');
assert.equal(rows[0][col('Loại')], 'Trả hàng/Hoàn tiền');
assert.equal(rows[0][col('Khóa')], 'GDD|2611R1|10-20');
assert.equal(rows[1][col('Khóa')], 'GDD|2611R1|11-0');
assert.notEqual(rows[0][col('Khóa')], rows[1][col('Khóa')], 'đơn nhiều sản phẩm không trùng khóa');
assert.equal(caseToRows({ ...sample, product_items: [] }, { code: 'GDD' }).length, 1, 'không có sản phẩm vẫn có 1 dòng');
assert.equal(caseId({ entity_type: 1, order_id: 5 }), '1-5');
const dup = caseToRows({ ...sample, product_items: [sample.product_items[0], sample.product_items[0]] }, { code: 'GDD' });
assert.notEqual(dup[0][col('Khóa')], dup[1][col('Khóa')], 'cùng phân loại 2 lần vẫn khác khóa');

// Sheet đang có: dòng 2-3 là yêu cầu này, dòng 4 là gian khác
const other = caseToRows({ ...sample, entity_id_str: '1-222', entity_type: 1, return_sn: '', order_sn: 'X1', product_items: [{}] }, { code: 'JOY' })[0];
const sheet = [HEADERS, rows[0], rows[1], other];

// Đọc lại không đổi gì (kể cả giờ đồng bộ khác): bỏ qua
const again = caseToRows(sample, { code: 'GDD', shopId: 7, syncedAt: 'lan2' });
let d = diffRows(sheet, again);
assert.deepEqual([d.append.length, d.update.length, d.unchanged], [0, 0, 2]);

// Trạng thái đổi: cập nhật đúng 2 dòng 2 và 3
const changed = caseToRows({ ...sample, header: { status_text: 'Đã hoàn tiền' } }, { code: 'GDD', shopId: 7, syncedAt: 'lan3' });
d = diffRows(sheet, changed);
assert.deepEqual(d.update.map((u) => u.row), [2, 3]);
assert.equal(d.append.length, 0);

// Đơn mới: thêm
const fresh = caseToRows({ ...sample, entity_id_str: '2-333', return_sn: 'R333' }, { code: 'GDD', shopId: 7, syncedAt: 'x' });
d = diffRows(sheet, [...again, ...fresh]);
assert.deepEqual([d.append.length, d.update.length, d.unchanged], [2, 0, 2]);

// Sheet bản trước (chưa có cột Khóa): nhận ra theo gian + ID dòng + sản phẩm, rồi cập nhật để điền Khóa
const oldLen = HEADERS.indexOf('Khóa');
const oldHead = HEADERS.slice(0, oldLen);
const legacy = [oldHead, rows[0].slice(0, oldLen), rows[1].slice(0, oldLen)];
d = diffRows(legacy, again);
assert.deepEqual(d.update.map((u) => u.row), [2, 3], 'dòng cũ được cập nhật để thêm Khóa, không thêm trùng');
assert.equal(d.append.length, 0);

const recs = sheetRecords(sheet);
assert.equal(recs.length, 3);
assert.equal(recs[2]['Mã gian'], 'JOY');
console.log('test-hh-api: OK');

// Ngày lấy từ 6 số đầu mã đơn / mã yêu cầu, và sắp xếp
{
  const { dateFromSn, timeValue } = globalThis.HHReturns;
  assert.equal(dateFromSn('261025HPDQYRRF'), '25/10/2026');
  assert.equal(dateFromSn('2610290UVY2970G'), '29/10/2026');
  assert.equal(dateFromSn(''), '');
  assert.equal(dateFromSn('ABC'), '');
  const r = caseToRows({ ...sample, order_sn: '261025HPDQYRRF', return_sn: '2610290UVY2970G' }, { code: 'BCE' })[0];
  assert.equal(r[col('Ngày đặt đơn')], '25/10/2026');
  assert.equal(r[col('Ngày hoàn hàng')], '29/10/2026');
  assert.equal(caseToRows({ ...sample, return_sn: '' }, { code: 'BCE' })[0][col('Ngày hoàn hàng')], '', 'không có mã yêu cầu thì trống');
  assert.ok(timeValue('02/11/2026') > timeValue('28/10/2026'));
}
console.log('test-hh-api (ngày): OK');

// Đơn chỉ hoàn tiền: phần hoàn trả lại vận đơn giao, trạng thái "Không có" -> không có mã hoàn
{
  const { caseToRows: toRows, HEADERS: HD } = globalThis.HHReturns;
  const refundOnly = { ...sample, forward_logistics_info: { tracking_numbers: ['SPXA'] }, reverse_logistics_info: { tracking_numbers: ['SPXA'], aggregated_logistics_status_text: 'Không có' } };
  assert.equal(toRows(refundOnly, { code: 'BCE' })[0][HD.indexOf('Vận đơn hoàn')], '');
  const real = { ...sample, forward_logistics_info: { tracking_numbers: ['SPXA'] }, reverse_logistics_info: { tracking_numbers: ['SPXB'], aggregated_logistics_status_text: 'Đang vận chuyển' } };
  assert.equal(toRows(real, { code: 'BCE' })[0][HD.indexOf('Vận đơn hoàn')], 'SPXB');
}
console.log('test-hh-api (vận đơn hoàn): OK');
