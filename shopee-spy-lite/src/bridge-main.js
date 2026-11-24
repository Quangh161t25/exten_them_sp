/*
 * bridge-main.js  (chạy ở MAIN world)
 * -----------------------------------
 * 1) Vá window.fetch + XMLHttpRequest để BẮT THỤ ĐỘNG mọi response của Shopee
 *    có chứa "/api/" rồi đẩy sang content script (ISOLATED) qua postMessage.
 *    -> Nhờ đó khi người dùng tự lướt trang search, ta có sẵn dữ liệu sold/price.
 * 2) Cung cấp cầu FETCH CHỦ ĐỘNG: content script gửi 1 URL, MAIN world fetch
 *    (kèm csrftoken + header giống app) rồi trả JSON về.
 *    -> Dùng cho "Spy từ khóa" khi cần tải thêm nhiều trang sản phẩm.
 *
 * Mô phỏng đúng cơ chế của extension gốc (shopee-fetch.js): patch fetch/XHR +
 * kênh postMessage ATSP_FETCH_LISTENER / ATSP_FETCH_URL.
 */
(function () {
  "use strict";
  if (window.__SPYLITE_BRIDGE__) return;
  window.__SPYLITE_BRIDGE__ = true;

  var CH_CAPTURE = "SPYLITE_CAPTURE";   // MAIN -> ISOLATED: response bắt được
  var CH_REQ = "SPYLITE_FETCH_REQ";     // ISOLATED -> MAIN: yêu cầu fetch
  var CH_RES = "SPYLITE_FETCH_RES";     // MAIN -> ISOLATED: kết quả fetch

  // ---- Lấy / tạo csrftoken giống app gốc ----
  function getCsrf() {
    var m = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    if (m) return m[1];
    try {
      var b = crypto.getRandomValues(new Uint8Array(16));
      var n = Array.from(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      document.cookie = "csrftoken=" + n + "; domain=.shopee.vn; path=/; secure; samesite=lax";
      return n;
    } catch (e) { return ""; }
  }

  function post(channel, data) {
    window.postMessage({ __spylite: true, channel: channel, data: data }, "*");
  }

  // ---- (1) Bắt thụ động ----
  function emitCapture(url, json) {
    try {
      if (!url || url.indexOf("/api/") === -1) return;
      if (url.indexOf("search_items") === -1 && url.indexOf("/search/") === -1) return;
      post(CH_CAPTURE, { url: url, json: json });
    } catch (e) {}
  }

  var _fetch = window.fetch;
  window.fetch = async function () {
    var args = arguments;
    var res = await _fetch.apply(this, args);
    try {
      var url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      if (url.indexOf("/api/") !== -1) {
        res.clone().json().then(function (j) { emitCapture(url, j); }).catch(function () {});
      }
    } catch (e) {}
    return res;
  };

  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__spyUrl = typeof url === "string" ? url : String(url);
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var self = this;
    var url = self.__spyUrl || "";
    if (url.indexOf("/api/") !== -1) {
      self.addEventListener("load", function () {
        if (self.status < 200 || self.status >= 300) return;
        try {
          var rt = self.responseType;
          var j = rt === "" || rt === "text" ? JSON.parse(self.responseText) : self.response;
          emitCapture(url, j);
        } catch (e) {}
      });
    }
    return _send.apply(this, arguments);
  };

  // ---- (2) Fetch chủ động theo yêu cầu ----
  window.addEventListener("message", async function (ev) {
    if (ev.source !== window) return;
    var msg = ev.data;
    if (!msg || !msg.__spylite || msg.channel !== CH_REQ) return;
    var id = msg.data && msg.data.id;
    var url = msg.data && msg.data.url;
    var out = { id: id, json: null, error: null };
    try {
      var headers = {
        accept: "application/json",
        "content-type": "application/json",
        "af-ac-enc-sz-token": "",
        "x-api-source": "pc",
        "x-shopee-language": "vi"
      };
      var csrf = getCsrf();
      if (csrf) headers["x-csrftoken"] = csrf;
      var r = await _fetch(url, { method: "GET", headers: headers, credentials: "include" });
      out.json = await r.json();
    } catch (e) {
      out.error = String(e);
    }
    post(CH_RES, out);
  });
})();
