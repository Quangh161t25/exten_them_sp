// Hàng hoàn API: đọc danh sách Trả hàng/Hoàn tiền/Hủy của Shopee và chuyển thành dòng Sheet HH API.
// Script thường (không phải module) để dùng chung cho trang app (<script>) và service worker (importScripts).
(function (root) {
  const SHEET_TITLE = 'HH API';
  const LIST_PATH = '/api/v4/seller_center/return/return_list/get_exceptional_case_list';
  const PAGE_SIZE = 40; // Shopee từ chối page_size lớn hơn
  const MAX_PAGES = 200;

  // case_tab của trang Trả hàng/Hoàn tiền/Hủy; 0 = Tất cả
  const LIST_BODY = {
    language: 'vi', is_reverse_sorting_order: false, page_number: 1, page_size: PAGE_SIZE,
    keyword: null, pending_action: null, request_solution: null,
    forward_logistics_statuses: [], reverse_logistics_statuses: [], return_reasons: [],
    create_time_range: { lower_value: null, upper_value: null },
    compensation_amount_option: null, advanced_fulfilment_option: null, seller_request_statuses: [],
    validation_type_option: null, request_adjusted: null,
    refund_amount_range: { lower_value: null, upper_value: null },
    invoice_statuses: null, fulfilled_by_shopee_option: null,
    flow_tab: 1, case_tab: 0, sorting_field: 1,
    key_action_due_time_range: { lower_value: null, upper_value: null },
    platform_type: 'sc'
  };

  const TYPES = { 1: 'Hủy', 2: 'Trả hàng/Hoàn tiền', 3: 'Giao không thành công' };

  // "Khóa" đặt cuối để sheet đang có (26 cột) chỉ cần thêm 1 cột
  const HEADERS = [
    'Mã gian', 'ID shop', 'Loại', 'Mã đơn', 'Mã yêu cầu', 'Trạng thái', 'Ghi chú trạng thái', 'Lý do', 'Phương án',
    'Người mua', 'Tên sản phẩm', 'Phân loại', 'SKU phân loại', 'SKU sản phẩm', 'Số lượng', 'Tiền hoàn',
    'Vận đơn giao', 'ĐVVC giao', 'Trạng thái giao', 'Vận đơn hoàn', 'ĐVVC hoàn', 'Trạng thái hoàn',
    'Cập nhật vận chuyển', 'Link đơn', 'ID dòng', 'Đồng bộ lúc', 'Khóa', 'Ngày đặt đơn', 'Ngày hoàn hàng'
  ];
  const IGNORE_ON_COMPARE = ['Đồng bộ lúc', 'Khóa'];

  const p2 = (n) => String(n).padStart(2, '0');
  function formatTime(sec) {
    const n = Number(sec);
    if (!n) return '';
    const d = new Date(n * 1000);
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }

  // Mã duy nhất của một yêu cầu trên trang Shopee
// "dd/mm/yyyy hh:mm" -> số để sắp xếp (rỗng = 0)
  function timeValue(text) {
    const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : 0;
  }

  // 6 số đầu của mã đơn / mã yêu cầu là ngày tạo dạng YYMMDD (vd 261025 -> 25/10/2026)
  function dateFromSn(sn) {
    const m = String(sn || '').match(/^(\d{2})(\d{2})(\d{2})/);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '';
    return `${m[3]}/${m[2]}/20${m[1]}`;
  }

  const caseId = (c) => String(c.entity_id_str || `${c.entity_type}-${c.return_id || c.order_id}`);

  // Khóa dòng cũ (chưa có cột Khóa): gian + yêu cầu + tên sản phẩm + phân loại
  const legacyKey = (r) => [r['Mã gian'], r['ID dòng'], r['Tên sản phẩm'], r['Phân loại']].map((v) => String(v ?? '').trim()).join('|');

  // Một dòng cho mỗi sản phẩm của yêu cầu
  function caseToRows(c, { code, shopId, syncedAt }) {
    const fwd = c.forward_logistics_info || {};
    const rev = c.reverse_logistics_info || {};
    // Đơn chỉ hoàn tiền (không gửi hàng về): Shopee vẫn trả vận đơn giao trong phần hoàn, trạng thái "Không có" -> coi là không có mã hoàn
    const fwdNos = new Set(fwd.tracking_numbers || []);
    const noReturn = /^không có$/i.test(String(rev.aggregated_logistics_status_text || '').trim());
    const revNos = noReturn ? [] : (rev.tracking_numbers || []).filter((n) => !fwdNos.has(n));
    const items = Array.isArray(c.product_items) && c.product_items.length ? c.product_items : [{}];
    const updated = Math.max(Number(fwd.latest_logistics_status_update_time) || 0, Number(rev.latest_logistics_status_update_time) || 0);
    const used = new Map();
    return items.map((it) => {
      // Khóa: gian + mã yêu cầu (hoặc mã đơn) + sản phẩm/phân loại, thêm số thứ tự nếu trùng trong cùng yêu cầu
      const item = it.product?.id || it.item_id ? `${it.product?.id || it.item_id}-${it.model?.id || 0}` : 'order';
      const n = (used.get(item) || 0) + 1;
      used.set(item, n);
      const record = {
        'Mã gian': code,
        'ID shop': String(shopId || c.shop_info?.shop_id || ''),
        'Loại': TYPES[c.entity_type] || `Loại ${c.entity_type}`,
        'Mã đơn': c.order_sn || '',
        'Mã yêu cầu': c.return_sn || '',
        'Trạng thái': c.header?.status_text || '',
        'Ghi chú trạng thái': c.header?.hint_text || '',
        'Lý do': c.request_reason_text || '',
        'Phương án': c.request_solution_text || '',
        'Người mua': c.buyer?.name || '',
        'Tên sản phẩm': it.product?.name || '',
        'Phân loại': it.model?.name || '',
        'SKU phân loại': it.model?.sku || '',
        'SKU sản phẩm': it.product?.sku || '',
        'Số lượng': it.amount ?? '',
        'Tiền hoàn': c.display_refund_amount || '',
        'Vận đơn giao': (fwd.tracking_numbers || []).join(', '),
        'ĐVVC giao': fwd.shipping_carrier || '',
        'Trạng thái giao': fwd.aggregated_logistics_status_text || '',
        'Vận đơn hoàn': revNos.join(', '),
        'ĐVVC hoàn': rev.shipping_carrier || '',
        'Trạng thái hoàn': rev.aggregated_logistics_status_text || '',
        'Cập nhật vận chuyển': formatTime(updated),
        'Link đơn': c.order_id ? `https://banhang.shopee.vn/portal/sale/order/${c.order_id}` : '',
        'ID dòng': caseId(c),
        'Đồng bộ lúc': syncedAt,
        'Khóa': [code, c.return_sn || c.order_sn || caseId(c), item, n > 1 ? n : ''].filter(Boolean).join('|'),
        'Ngày đặt đơn': dateFromSn(c.order_sn),
        'Ngày hoàn hàng': dateFromSn(c.return_sn)
      };
      return HEADERS.map((h) => record[h]);
    });
  }

  // Dòng sheet -> object theo tiêu đề (bỏ dòng trống)
  function sheetRecords(values) {
    if (!values?.length) return [];
    const [headers, ...rows] = values;
    return rows
      .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])))
      .filter((r) => r['Mã đơn'] || r['ID dòng']);
  }

  /**
   * So sánh dòng mới với sheet (đọc 1 lần).
   * @param oldValues giá trị sheet hiện tại (dòng đầu là tiêu đề, cột theo tên)
   * @param newRows dòng mới theo HEADERS
   * @returns {{append: any[][], update: {row: number, values: any[]}[], unchanged: number}}
   *   row: số dòng trên sheet (1 = tiêu đề)
   */
  function diffRows(oldValues, newRows) {
    const headers = oldValues?.[0] || [];
    const byKey = new Map();
    const byLegacy = new Map();
    (oldValues || []).slice(1).forEach((row, i) => {
      const rec = Object.fromEntries(headers.map((h, j) => [h, row[j] ?? '']));
      const entry = { row: i + 2, rec };
      if (rec['Khóa']) byKey.set(String(rec['Khóa']), entry);
      else byLegacy.set(legacyKey(rec), entry);
    });
    const keyCol = HEADERS.indexOf('Khóa');
    const result = { append: [], update: [], unchanged: 0 };
    const taken = new Set();
    for (const values of newRows) {
      const rec = Object.fromEntries(HEADERS.map((h, j) => [h, values[j] ?? '']));
      let hit = byKey.get(String(values[keyCol]));
      if (!hit) hit = byLegacy.get(legacyKey(rec));
      if (!hit || taken.has(hit.row)) {
        result.append.push(values);
        continue;
      }
      taken.add(hit.row);
      const changed = HEADERS.some((h) => !IGNORE_ON_COMPARE.includes(h) && String(hit.rec[h] ?? '') !== String(rec[h] ?? ''))
        || String(hit.rec['Khóa'] ?? '') !== String(rec['Khóa']);
      if (changed) result.update.push({ row: hit.row, values });
      else result.unchanged++;
    }
    return result;
  }

  root.HHReturns = { dateFromSn, timeValue, SHEET_TITLE, LIST_PATH, PAGE_SIZE, MAX_PAGES, LIST_BODY, TYPES, HEADERS, formatTime, caseId, caseToRows, sheetRecords, diffRows };
})(typeof self !== 'undefined' ? self : globalThis);
