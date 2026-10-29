// Lớp gọi API Kênh Người Bán Shopee.
// Mọi request được chạy BÊN TRONG một tab banhang.shopee.vn (qua chrome.scripting),
// nên trình duyệt tự gửi kèm cookie đăng nhập như khi bạn thao tác trên web.

const SELLER_ORIGIN = 'https://banhang.shopee.vn';

let cachedTabId = null;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitTabComplete(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Hết thời gian chờ tải trang Kênh Người Bán'));
    }, timeout);
    function listener(id, info, tab) {
      if (id === tabId && info.status === 'complete') {
        cleanup();
        resolve(tab);
      }
    }
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        cleanup();
        resolve(t);
      }
    }).catch((e) => {
      cleanup();
      reject(e);
    });
  });
}

// Tìm (hoặc mở ngầm) một tab Kênh Người Bán để chạy request.
async function getSellerTab() {
  if (cachedTabId !== null) {
    try {
      const t = await chrome.tabs.get(cachedTabId);
      if (t.url && t.url.startsWith(SELLER_ORIGIN)) {
        if (t.status !== 'complete') await waitTabComplete(t.id);
        return t.id;
      }
    } catch (e) { /* tab đã đóng */ }
    cachedTabId = null;
  }

  const tabs = await chrome.tabs.query({ url: SELLER_ORIGIN + '/*' });
  let tab = tabs.find((t) => t.status === 'complete') || tabs[0];
  if (!tab) {
    throw new Error('Chưa mở tab Kênh Người Bán Shopee. Vui lòng mở banhang.shopee.vn để tiếp tục.');
  }
  tab = await waitTabComplete(tab.id);
  if (!tab.url || !tab.url.startsWith(SELLER_ORIGIN)) {
    throw new Error('Bạn chưa đăng nhập Kênh Người Bán Shopee. Hãy mở banhang.shopee.vn và đăng nhập.');
  }
  cachedTabId = tab.id;
  return tab.id;
}

// Hàm này được inject và chạy trong tab Shopee.
function pageFetch(url, method, body) {
  return fetch(url, {
    method,
    credentials: 'include',
    signal: AbortSignal.timeout(25000),
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json'
    },
    body: body == null ? undefined : JSON.stringify(body)
  })
    .then(async (r) => ({ status: r.status, text: await r.text() }))
    .catch((e) => ({ status: 0, text: '', error: String(e) }));
}

async function getSpcCds() {
  const c = await chrome.cookies.get({ url: SELLER_ORIGIN, name: 'SPC_CDS' });
  return (c && c.value) || '';
}

export async function request(method, path, { params = {}, body = null } = {}) {
  const tabId = await getSellerTab();
  const spc = await getSpcCds();
  const qs = new URLSearchParams({ SPC_CDS: spc, SPC_CDS_VER: '2' });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${SELLER_ORIGIN}${path}?${qs.toString()}`;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageFetch,
    args: [url, method, body]
  });
  const result = injection && injection.result;
  if (!result) throw new Error('Không chạy được request trong tab Shopee');
  if (result.error) throw new Error('Lỗi mạng: ' + result.error);
  if (result.status === 401 || result.status === 403) {
    throw new Error(`Shopee từ chối (HTTP ${result.status}). Hãy đăng nhập lại Kênh Người Bán.`);
  }

  let json;
  try {
    json = JSON.parse(result.text);
  } catch (e) {
    throw new Error(`Phản hồi không phải JSON (HTTP ${result.status})`);
  }
  const code = json.code ?? json.error ?? 0;
  if (code) {
    const err = new Error(json.message || json.msg || json.err_msg || `Shopee trả lỗi code ${code}`);
    err.code = code;
    err.response = json;
    throw err;
  }
  return json.data;
}

export async function getShopInfo() {
  const d = await request('GET', '/api/selleraccount/shop_info/');
  return { name: (d && (d.name || d.shop_name)) || '', shopId: d && (d.shop_id || d.shopid) };
}

// ---------- Đơn hàng ----------

export const orders = {
  // 1 trang mã đơn của 1 tab trạng thái. sentinel: lấy từ lần gọi trước.
  async listIndex({ tab, page = 1, pageSize = 40, sentinel = '' }) {
    const body = {
      order_list_tab: Number(tab),
      entity_type: 1,
      pagination: {
        from_page_number: page > 1 ? page - 1 : 1,
        page_number: page,
        page_size: pageSize,
        page_sentinel: sentinel || ''
      },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: 0 }
    };
    const d = await request('POST', '/api/v3/order/search_order_list_index', { body });
    const pg = (d && d.pagination) || {};
    return {
      index: (d && d.index_list) || [],
      total: Number(pg.total || 0),
      // Kênh Người Bán dùng previous_page_sentinel cho trang kế tiếp
      sentinel: pg.previous_page_sentinel || pg.next_page_sentinel || ''
    };
  },

  // Chi tiết các đơn (tối đa 5 mã đơn / lần).
  async cards({ tab, index }) {
    const d = await request('POST', '/api/v3/order/get_order_list_card_list', {
      body: { order_list_tab: Number(tab), need_count_down_desc: false, order_param_list: index }
    });
    return ((d && d.card_list) || []).map((c) => c.order_card || c);
  },

  // Chi tiết đầy đủ 1 đơn (trang "Xem chi tiết" của Kênh Người Bán).
  async getOne(orderId) {
    return request('GET', '/api/v3/order/get_one_order', { params: { order_id: orderId } });
  },

  // Thông tin thanh toán / doanh thu của 1 đơn (phần "Thông tin thanh toán" trong trang chi tiết đơn).
  // Shopee chỉ trả bảng doanh thu khi gửi đúng các "components" cần lấy; chưa biết chắc giá trị,
  // nên thử lần lượt các dạng và nhớ dạng nào dùng được cho các đơn sau.
  async income(orderId) {
    const path = '/api/v4/accounting/pc/seller_income/income_detail/get_order_income_components';
    const id = Number(orderId);
    const variants = [
      { order_id: id, components: [2, 3] },
      { order_id: id, components: [1, 2, 3] },
      { order_id: id, components: [1, 2, 3, 4, 5] },
      { order_id: id },
      { order_id: String(orderId), components: [2, 3] }
    ];
    const order = incomeVariant === null ? variants.map((_, i) => i) : [incomeVariant, ...variants.map((_, i) => i).filter((i) => i !== incomeVariant)];
    let last = null;
    let lastErr = null;
    for (const i of order) {
      try {
        const d = await request('POST', path, { body: variants[i] });
        last = d;
        const rows = d && d.seller_income_breakdown && d.seller_income_breakdown.breakdown;
        if (Array.isArray(rows) && rows.length) {
          incomeVariant = i;
          return d;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr && !last) throw lastErr;
    const err = new Error('Shopee không trả bảng doanh thu cho đơn này');
    err.response = last;
    throw err;
  }
};

let incomeVariant = null; // dạng request doanh thu đã dùng được

// ---------- Phiếu giao (shipping document) ----------

// Chạy trong tab Kênh Người Bán: tải file nhị phân (PDF) và trả về base64.
function pageFetchBinary(url) {
  return fetch(url, {
    credentials: 'include',
    headers: { accept: 'application/json, application/force-download, text/plain, */*' }
  })
    .then(async (r) => {
      const type = r.headers.get('content-type') || '';
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (!/pdf|octet|force-download/i.test(type)) {
        return { status: r.status, type, text: new TextDecoder().decode(bytes.slice(0, 2000)) };
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { status: r.status, type, base64: btoa(bin), size: bytes.length };
    })
    .catch((e) => ({ status: 0, error: String(e) }));
}

export const shippingDoc = {
  /**
   * Tạo job in "Phiếu gửi hàng và Phiếu đóng gói" cho các kiện cùng 1 kênh vận chuyển.
   * packages: [{ packageNumber, orderId }]
   */
  async createJob({ shopId, channelId, packages }) {
    const body = {
      group_list: packages.map((p) => ({
        primary_package_number: p.packageNumber,
        group_shipment_id: 0,
        package_list: [{ package_number: p.packageNumber, order_id: Number(p.orderId) }]
      })),
      channel_id: Number(channelId),
      generate_file_details: [{ file_name: 'Phiếu gửi hàng và Phiếu đóng gói', file_type: 'NORMAL_PDF', file_contents: [1] }],
      record_generate_schema: true,
      region_id: 'VN',
      shop_id: Number(shopId)
    };
    const d = await request('POST', '/api/v3/logistics/create_sd_jobs', { params: { async_sd_version: '0.2' }, body });
    const job = d && d.list && d.list[0];
    if (!job || !job.job_id) throw new Error('Shopee không trả mã job in phiếu giao');
    return job;
  },

  // Tải PDF của job; nếu Shopee chưa tạo xong file thì chờ rồi thử lại vài lần.
  async downloadPdf(jobId, { tries = 6, waitMs = 2500 } = {}) {
    const tabId = await getSellerTab();
    const spc = await getSpcCds();
    const url = `${SELLER_ORIGIN}/api/v3/logistics/download_sd_job?${new URLSearchParams({ job_id: jobId, is_first_time: '0', SPC_CDS: spc, SPC_CDS_VER: '2' })}`;
    let last = null;
    for (let i = 0; i < tries; i++) {
      const [inj] = await chrome.scripting.executeScript({ target: { tabId }, func: pageFetchBinary, args: [url] });
      last = inj && inj.result;
      if (last && last.base64) return last;
      if (last && last.error) throw new Error('Lỗi mạng khi tải phiếu giao: ' + last.error);
      await sleep(waitMs);
    }
    throw new Error('Chưa tải được PDF phiếu giao' + (last && last.text ? ': ' + last.text.slice(0, 200) : ''));
  }
};

// ---------- Chuẩn bị hàng (yêu cầu đơn vị vận chuyển tới lấy hàng) ----------

const toGroupList = (packages) => packages.map((p) => ({
  primary_package_number: p.packageNumber,
  group_shipment_id: 0,
  package_list: [{ order_id: Number(p.orderId), package_number: p.packageNumber }]
}));

export const shipment = {
  // Các ngày / khung giờ lấy hàng cho địa chỉ lấy hàng + các kiện
  async pickupTimeSlots(addressId, packageNumbers) {
    const d = await request('POST', '/api/v3/shipment/mass_ship/get_pickup_time_slots', {
      body: { address_id: Number(addressId), package_numbers: packageNumbers }
    });
    return {
      slots: (d && d.time_slots) || [],
      preDate: (d && d.pre_select_date_idx) || 0,
      preSlot: (d && d.pre_select_timeslot_idx) || 0
    };
  },

  // Xác nhận "Chuẩn bị hàng" – lấy hàng tận nơi. Trả { groupId, results: [{ packageNumber, ok, message }] }
  async initOrders({ shopId, channelId, packages, addressId, pickupTime, remark = '' }) {
    const d = await request('POST', '/api/v3/shipment/batch_init_orders', {
      body: {
        channel_id: Number(channelId),
        group_list: toGroupList(packages),
        pickup_address_id: Number(addressId),
        pickup_time: Number(pickupTime),
        region_id: 'VN',
        remark,
        shipping_mode: 'pickup',
        shop_id: Number(shopId)
      }
    });
    const header = (d && d.header) || {};
    if (header.retcode) throw new Error(header.message || `Shopee báo lỗi ${header.retcode}`);
    const results = ((d && d.data) || []).map((g) => ({
      packageNumber: g.primary_package_number,
      ok: !g.retcode,
      message: g.message || g.transify_key || (g.retcode ? `mã lỗi ${g.retcode}` : '')
    }));
    return { groupId: d && d.group_id, results };
  },

  // Trạng thái xử lý của các kiện (Shopee gợi ý thời gian thăm dò trong polling_mode)
  async packageStatus({ shopId, channelId, packages }) {
    const d = await request('POST', '/api/v3/shipment/batch_get_package_shipment_status', {
      body: { channel_id: Number(channelId), group_list: toGroupList(packages), region_id: 'VN', shop_id: Number(shopId) }
    });
    return {
      list: (d && d.group_status_list) || [],
      total: (d && d.total_num) || 0,
      success: (d && d.success_num) || 0,
      polling: (d && d.polling_mode) || null
    };
  },

  // Kiện nào đã in được phiếu giao
  async canPrint({ shopId, packages }) {
    const d = await request('POST', '/api/v3/shipment/can_print_waybill', {
      body: { group_list: toGroupList(packages), page_type: 2, region_id: 'VN', shop_id: Number(shopId) }
    });
    return ((d && d.list) || []).map((x) => ({
      packageNumber: x.primary_package_number,
      canPrint: !!(x.can_print_normal_waybill || x.can_print_waybill),
      printed: !!x.is_awb_printed
    }));
  }
};
