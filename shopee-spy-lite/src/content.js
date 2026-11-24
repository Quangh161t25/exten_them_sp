/*
 * content.js (ISOLATED world) - Shopee Spy Lite
 * =============================================
 * Chức năng 1: "Spy sản phẩm" - chèn dải số liệu dưới MỖI sản phẩm trên trang search.
 * Chức năng 2: "Spy từ khóa" - nút nổi mở popup tổng hợp cả trang kết quả của từ khóa.
 *
 * Dữ liệu từ API Shopee /api/v4/search/search_items:
 *  - bắt THỤ ĐỘNG khi lướt (qua bridge-main.js)
 *  - fetch CHỦ ĐỘNG đúng từ khóa + sort + trang đang xem (vì trang đầu Shopee SSR,
 *    không gọi API nên phải tự fetch mới có số liệu để chèn).
 * Đường dẫn field bám đúng bản gốc (hàm vl trong shopee-client.js).
 */
(function () {
  "use strict";

  var SLUG_RE = /-i\.(\d+)\.(\d+)/;
  var ORIGIN = "https://shopee.vn";
  var PAGE_SIZE = 60;
  var dataMap = new Map();            // `${shopid}_${itemid}` -> item chuẩn hóa
  var pendingFetch = new Map();
  var fetchSeq = 0;
  var syncing = false;
  var lastSyncKey = "";

  // ---------- tiện ích ----------
  function vnd(n) {
    n = Math.round(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " tỷ";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " tr";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(n);
  }
  function num(n) { return Math.round(n || 0).toLocaleString("vi-VN"); }
  function money(n) { return num(n) + "₫"; }
  function fmtDate(sec) {
    if (!sec) return "-";
    var d = new Date(sec * 1000);
    if (isNaN(d.getTime())) return "-";
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  }
  function get(obj, path) {
    var p = path.split("."), o = obj;
    for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; }
    return o;
  }
  var price = function (p) { p = +p || 0; return p > 0 ? p / 1e5 : 0; };

  // ---------- chuẩn hóa 1 item (giống hàm vl bản gốc) ----------
  function normItem(raw) {
    if (!raw) return null;
    var asset = raw.item_card_displayed_asset || {};
    var it = {
      shopid: raw.shopid, itemid: raw.itemid,
      name: asset.name || "", shop: "", brand: "",
      sold: 0, hist: 0, price: 0, strike: 0, ctime: 0, catid: 0,
      flag: get(raw, "item_card_displayed_asset.seller_flag.name") || ""
    };

    if (raw.item_basic) {
      var b = raw.item_basic;
      it.shopid = it.shopid || b.shopid; it.itemid = it.itemid || b.itemid;
      it.name = it.name || b.name || "";
      it.sold = b.sold || 0; it.hist = b.historical_sold || b.sold || 0;
      it.price = price(b.price); it.strike = price(b.price_before_discount);
      it.ctime = b.ctime || 0; it.catid = b.catid || 0;
      it.brand = (typeof b.brand === "string" ? b.brand : "") || "";
      it.shop = b.shop_name || "";
    } else if (raw.item_data) {
      var d = raw.item_data;
      var sc = d.item_card_display_sold_count || {};
      var pc = d.item_card_display_price || {};
      it.sold = sc.monthly_sold_count || 0;
      it.hist = sc.historical_sold_count || 0;
      it.price = price(pc.price);
      it.strike = price(pc.strikethrough_price);
      it.ctime = d.ctime || 0;
      it.catid = d.catid || 0;
      it.brand = get(d, "global_brand.display_name") || "";
      it.shop = get(d, "shop_data.shop_name") || "";
      if (d.itemid) it.itemid = d.itemid;
      if (d.shopid) it.shopid = d.shopid;
    } else {
      it.sold = raw.sold || 0; it.hist = raw.historical_sold || raw.sold || 0;
      it.price = price(raw.price); it.ctime = raw.ctime || 0; it.catid = raw.catid || 0;
    }
    if (!it.shopid || !it.itemid) return null;
    it.revenue = it.sold * it.price;
    return it;
  }

  function storeItems(items) {
    if (!Array.isArray(items)) return [];
    var out = [];
    items.forEach(function (raw) {
      var it = normItem(raw);
      if (it) { dataMap.set(it.shopid + "_" + it.itemid, it); out.push(it); }
    });
    return out;
  }

  // ---------- cầu nối MAIN world ----------
  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var msg = ev.data;
    if (!msg || !msg.__spylite) return;
    if (msg.channel === "SPYLITE_CAPTURE") {
      var j = msg.data && msg.data.json;
      if (j && j.items) { storeItems(j.items); decorateAll(); }
    } else if (msg.channel === "SPYLITE_FETCH_RES") {
      var cb = pendingFetch.get(msg.data && msg.data.id);
      if (cb) { pendingFetch.delete(msg.data.id); cb(msg.data); }
    }
  });

  function fetchViaBridge(url) {
    return new Promise(function (resolve) {
      var id = "f" + (++fetchSeq);
      pendingFetch.set(id, resolve);
      window.postMessage({ __spylite: true, channel: "SPYLITE_FETCH_REQ", data: { id: id, url: url } }, "*");
      setTimeout(function () {
        if (pendingFetch.has(id)) { pendingFetch.delete(id); resolve({ error: "timeout" }); }
      }, 9000);
    });
  }

  // sortBy trên URL -> tham số by/order của API
  function mapBy(sortBy) {
    switch (sortBy) {
      case "sales": return { by: "sales", order: "desc" };
      case "ctime": return { by: "ctime", order: "desc" };
      case "price": return { by: "price", order: "asc" };
      default: return { by: "relevancy", order: "desc" };
    }
  }
  function curSearch() {
    try {
      var u = new URL(location.href);
      return {
        keyword: u.searchParams.get("keyword") || "",
        page: parseInt(u.searchParams.get("page") || "0", 10) || 0,
        sortBy: u.searchParams.get("sortBy") || "relevancy"
      };
    } catch (e) { return { keyword: "", page: 0, sortBy: "relevancy" }; }
  }
  function buildSearchUrl(keyword, page, sortBy) {
    var b = mapBy(sortBy);
    var q = {
      by: b.by, keyword: keyword, limit: PAGE_SIZE, newest: page * PAGE_SIZE,
      order: b.order, page_type: "search", scenario: "PAGE_GLOBAL_SEARCH", version: 2
    };
    var qs = Object.keys(q).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(q[k]);
    }).join("&");
    return ORIGIN + "/api/v4/search/search_items?" + qs;
  }

  // ========== CHỨC NĂNG 1: Spy sản phẩm ==========
  function parseSlug(href) {
    var m = (href || "").match(SLUG_RE);
    return m ? { shopid: +m[1], itemid: +m[2] } : null;
  }
  function statRow(label, value, strong) {
    return '<div class="spl-row"><span class="spl-k">' + label + '</span>' +
      '<span class="spl-v' + (strong ? " spl-strong" : "") + '">' + value + "</span></div>";
  }
  function decorateCard(a, rank) {
    var ids = parseSlug(a.getAttribute("href") || a.href || "");
    if (!ids) return;
    var li = a.closest("li") || a.parentElement;
    if (!li) return;
    var it = dataMap.get(ids.shopid + "_" + ids.itemid);
    var old = li.querySelector(":scope > .spl-card") || li.querySelector(".spl-card");
    if (!it) return;
    var sig = ids.shopid + "_" + ids.itemid + "@" + rank;
    if (old && old.getAttribute("data-sig") === sig) return;
    if (old) old.remove();

    var box = document.createElement("div");
    box.className = "spl-card";
    box.setAttribute("data-sig", sig);
    var flag = it.flag ? '<span class="spl-flag">' + it.flag + "</span>" : "";
    box.innerHTML =
      '<div class="spl-head">Spy sản phẩm <span class="spl-rank">#' + rank + "</span></div>" +
      statRow("Lượt bán/tháng", num(it.sold)) +
      statRow("Doanh số", money(it.revenue), true) +
      statRow("Bán tổng", num(it.hist)) +
      statRow("Giá", money(it.price)) +
      statRow("Ngày tạo", fmtDate(it.ctime)) +
      (it.shop ? statRow("Shop", it.shop + " " + flag) : (flag ? statRow("Shop", flag) : "")) +
      (it.brand ? statRow("Thương hiệu", it.brand) : "");
    li.appendChild(box);
    li.classList.add("spl-has");
  }
  function decorateAll() {
    var cs = curSearch();
    var offset = cs.page * PAGE_SIZE;
    var cards = document.querySelectorAll("a.contents[href*='-i.']");
    cards.forEach(function (a, i) { decorateCard(a, offset + i + 1); });
  }

  // Tự fetch đúng trang/sort đang xem rồi chèn (trang đầu Shopee SSR không gọi API)
  async function syncSearchData(force) {
    var cs = curSearch();
    if (!cs.keyword) return;
    var key = cs.keyword + "|" + cs.sortBy + "|" + cs.page;
    if (!force && key === lastSyncKey) return;
    if (syncing) return;
    syncing = true; lastSyncKey = key;
    try {
      var res = await fetchViaBridge(buildSearchUrl(cs.keyword, cs.page, cs.sortBy));
      var j = res && res.json;
      if (j && j.items) { storeItems(j.items); decorateAll(); }
    } finally { syncing = false; }
  }

  // ========== CHỨC NĂNG 2: Spy từ khóa ==========
  function aggregate(items) {
    var shops = new Set(), brands = new Set(), cats = new Set();
    var totalSold = 0, totalRev = 0;
    items.forEach(function (it) {
      if (it.shopid) shops.add(it.shopid);
      if (it.brand) brands.add(it.brand);
      if (it.catid) cats.add(it.catid);
      totalSold += it.sold; totalRev += it.revenue;
    });
    var top = items.slice().sort(function (a, b) { return b.sold - a.sold; }).slice(0, 10);
    return { count: items.length, shops: shops.size, brands: brands.size, cats: cats.size,
      totalSold: totalSold, totalRev: totalRev, top: top };
  }
  function kpi(label, value) {
    return '<div class="spl-kpi"><div class="spl-kpi-v">' + value + '</div><div class="spl-kpi-k">' + label + "</div></div>";
  }
  function renderPopup(keyword, agg) {
    var pop = document.getElementById("spl-popup");
    if (!pop) { pop = document.createElement("div"); pop.id = "spl-popup"; document.body.appendChild(pop); }
    var rows = agg.top.map(function (it, i) {
      var nm = it.name || ("SP " + it.itemid);
      return '<tr><td class="spl-c">' + (i + 1) + '</td><td class="spl-name" title="' + nm.replace(/"/g, "") +
        '">' + nm + '</td><td class="spl-r">' + money(it.price) + '</td><td class="spl-r">' + num(it.sold) +
        '</td><td class="spl-r">' + vnd(it.revenue) + "</td></tr>";
    }).join("");
    pop.innerHTML =
      '<div class="spl-pop-head"><div class="spl-pop-title">Spy từ khóa</div>' +
        '<button id="spl-close" class="spl-x">✕</button></div>' +
      '<div class="spl-kw">' + (keyword || "-") + "</div>" +
      '<div class="spl-sub">Đã tải ' + agg.count + " sản phẩm · " + new Date().toLocaleString("vi-VN") + "</div>" +
      '<div class="spl-kpis">' + kpi("Ngành con", agg.cats) + kpi("Thương hiệu", agg.brands) +
        kpi("Shop", agg.shops) + kpi("Đã bán", num(agg.totalSold)) + kpi("Doanh số", vnd(agg.totalRev)) + "</div>" +
      '<div class="spl-top-title">Top bán chạy</div>' +
      '<table class="spl-table"><thead><tr><th>#</th><th>Sản phẩm</th><th>Giá</th><th>Đã bán</th><th>Doanh số</th></tr></thead>' +
      "<tbody>" + (rows || '<tr><td colspan="5" class="spl-empty">Không có dữ liệu</td></tr>') + "</tbody></table>";
    pop.style.display = "block";
    var x = document.getElementById("spl-close");
    if (x) x.onclick = function () { pop.style.display = "none"; };
  }
  async function runKeywordSpy(btn) {
    var cs = curSearch();
    if (!cs.keyword) { alert("Hãy mở một trang tìm kiếm Shopee (có từ khóa) trước."); return; }
    btn.disabled = true; var old = btn.textContent; btn.textContent = "Đang tải...";
    var pages = 3, collected = [];
    for (var p = 0; p < pages; p++) {
      var res = await fetchViaBridge(buildSearchUrl(cs.keyword, p, cs.sortBy));
      var j = res && res.json;
      if (!j || !j.items || !j.items.length) break;
      collected = collected.concat(storeItems(j.items));
      if (j.items.length < PAGE_SIZE) break;
    }
    btn.disabled = false; btn.textContent = old;
    if (!collected.length) collected = Array.from(dataMap.values());
    // loại trùng theo key
    var seen = {}, uniq = [];
    collected.forEach(function (it) { var k = it.shopid + "_" + it.itemid; if (!seen[k]) { seen[k] = 1; uniq.push(it); } });
    renderPopup(cs.keyword, aggregate(uniq));
    decorateAll();
  }

  function mountButton() {
    if (document.getElementById("spl-fab")) return;
    var b = document.createElement("button");
    b.id = "spl-fab"; b.textContent = "Spy từ khóa";
    b.onclick = function () { runKeywordSpy(b); };
    document.body.appendChild(b);
  }

  // ========== khởi động ==========
  function boot() { mountButton(); syncSearchData(true); decorateAll(); }
  var obs = new MutationObserver(function () {
    clearTimeout(window.__splT);
    window.__splT = setTimeout(decorateAll, 300);
  });
  function start() {
    if (!document.body) { setTimeout(start, 300); return; }
    boot();
    obs.observe(document.body, { childList: true, subtree: true });
  }
  start();

  var lastHref = location.href;
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(function () { syncSearchData(false); decorateAll(); }, 700);
    }
  }, 1000);
})();
