const { parseShopInput, getShopBase, getShopItems, mapItem, fmt, escapeHtml, renderShopHead } = window.SpyApi;
const $ = (id) => document.getElementById(id);
let current = null;

function show(id, on) { $(id).classList.toggle('hidden', !on); }

function openFull(target) {
  const query = target.shopId ? { shopId: target.shopId } : { username: target.username };
  chrome.runtime.sendMessage({ type: 'OPEN_SPY', query });
  window.close();
}

async function run() {
  const target = parseShopInput($('q').value);
  show('err', false);
  if (!target) {
    $('err').textContent = 'Không nhận diện được shop. Dán link shop, link sản phẩm, username hoặc shop ID.';
    show('err', true);
    return;
  }
  show('hint', false);
  show('result', false);
  show('loading', true);
  $('go').disabled = true;
  try {
    const info = await getShopBase(target);
    const shopId = String(info.shopid || target.shopId);
    current = { shopId };
    $('head').innerHTML = renderShopHead(info, shopId);

    const { items } = await getShopItems(shopId, 40, 0);
    const rows = items.map(mapItem);
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
    $('stats').innerHTML = [
      ['Đã bán (mẫu)', fmt.num(sum('sold'))],
      ['Doanh thu (mẫu)', fmt.short(sum('sale'))],
      ['Bán 30 ngày', fmt.num(sum('soldMonth'))],
    ].map(([l, v]) => `<div class="card stat"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('');
    $('note').textContent = `Thống kê nhanh trên ${rows.length} sản phẩm phổ biến nhất. Xem đầy đủ để quét toàn shop.`;

    const top = [...rows].sort((a, b) => b.sold - a.sold).slice(0, 5);
    $('top').innerHTML = top.length
      ? top.map((r) => `
        <a class="top-item" href="${escapeHtml(r.url)}" target="_blank">
          <img src="${escapeHtml(r.image)}_tn" alt="">
          <div class="name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>
          <div class="num"><b>${fmt.num(r.sold)}</b><div class="muted">${fmt.short(r.sale)}</div></div>
        </a>`).join('')
      : '<div class="muted" style="padding:10px">Không lấy được sản phẩm.</div>';
    show('result', true);
  } catch (e) {
    $('err').textContent = e.message || String(e);
    show('err', true);
  } finally {
    show('loading', false);
    $('go').disabled = false;
  }
}

$('go').addEventListener('click', run);
$('q').addEventListener('keydown', (e) => e.key === 'Enter' && run());
$('full').addEventListener('click', () => current && openFull(current));

// Tự nhận diện shop từ tab đang mở
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab && tab.url && parseShopInput(tab.url) && tab.url.includes('shopee.vn')) {
    $('q').value = tab.url;
    run();
  }
});
