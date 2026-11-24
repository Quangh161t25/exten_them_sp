// TOPCARE - Cảm ơn khách 1 chạm
// Thêm nút "💚 Cảm ơn" cạnh tên người mua trên trang Quản lý đơn hàng.
// Bấm nút: mở khung chat với khách và điền sẵn lời cảm ơn (khác nhau cho mỗi khách).
// Mặc định KHÔNG tự gửi: bạn đọc lại rồi tự bấm Enter. Muốn tự gửi thì đổi AUTO_SEND = true.

const AUTO_SEND = false;

const OPENERS = [
  "Dạ {shop} cảm ơn {xung} đã tin chọn {sp} ạ!",
  "Cảm ơn {xung} đã ủng hộ {shop} với {sp} ạ!",
  "Dạ shop cảm ơn {xung} đã đặt {sp} ạ 🙏",
  "{shop} xin cảm ơn {xung} đã chọn {sp} ạ!",
  "Shop vui lắm khi {xung} chọn {sp} của {shop} ạ!",
];
const STATUS = {
  "Chờ lấy hàng": [
    "Đơn đã được đóng gói kỹ và đang chờ bên vận chuyển đến lấy.",
    "Shop đã chuẩn bị hàng xong, đơn sẽ sớm tới tay mình.",
    "Hàng đã sẵn sàng, chỉ chờ đơn vị vận chuyển qua lấy thôi ạ.",
  ],
  "Đang giao": [
    "Đơn đang trên đường tới tay mình rồi ạ.",
    "Hàng đã giao cho đơn vị vận chuyển, mình để ý điện thoại giúp shop nhé.",
  ],
  "Đã giao": [
    "Đơn đã giao tới mình rồi, chúc {xung} dùng thật ưng ý.",
    "Hàng đã tới tay mình, có gì chưa rõ cách dùng cứ nhắn shop nhé.",
  ],
  _: ["Shop đã xử lý đơn của mình rồi ạ."],
};
// Mẹo theo loại sản phẩm (khớp theo từ khóa trong tên sản phẩm)
const TIPS = [
  [/nấu chậm/i, ["Mẹo nhỏ: tối cho nguyên liệu vào chế độ hầm, sáng ra có ngay cháo nóng.", "Nồi rất hợp nấu cháo, chưng yến cho cả nhà ạ."]],
  [/chiên nhúng|bếp chiên|ngập dầu/i, ["Lần đầu dùng mình đổ dầu trong vạch MIN–MAX và đợi đèn nhiệt tắt rồi mới thả đồ chiên nhé.", "Chúc mình buôn may bán đắt ạ!"]],
  [/nồi chiên/i, ["Lần đầu dùng mình chạy không tải 5 phút cho bay mùi máy mới nhé.", "Nướng gà nguyên con khoảng 180°C, 35–40 phút là vàng giòn ạ."]],
  [/luộc gà/i, ["Nồi size lớn luộc vừa gà to nguyên con luôn ạ."]],
  [/áp suất/i, ["Hầm sườn chỉ khoảng 15–20 phút là mềm, mình nhớ chờ xả hết hơi mới mở nắp nhé."]],
  [/chảo/i, ["Mẹo: làm nóng chảo vừa lửa rồi mới cho dầu, đồ chiên sẽ không dính ạ."]],
  [/nồi cơm/i, ["Mình vo gạo xong để ráo 15 phút trước khi nấu, cơm sẽ dẻo ngon hơn ạ."]],
  [/sữa hạt/i, ["Ngâm hạt qua đêm trước khi xay, sữa sẽ mịn và thơm hơn ạ."]],
  [/inox|nồi/i, ["Lần đầu dùng mình rửa nồi với nước ấm pha chút giấm cho sáng bóng nhé."]],
];
const CLOSERS = [
  "Có gì cần hỗ trợ {xung} cứ nhắn shop nhé! 💚",
  "Nhận hàng có gì thắc mắc mình nhắn {shop} liền nha!",
  "Chúc nhà mình có những bữa cơm thật ngon 💚",
  "Cảm ơn mình rất nhiều vì đã đồng hành cùng shop 🙏",
  "Hài lòng thì đánh giá 5⭐ giúp shop nha, shop cảm ơn nhiều ạ!",
];

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function shortName(product) {
  // Lấy phần đầu tên sản phẩm, bỏ phần mô tả dài
  return product.split(/[,–|]| - /)[0].replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
}

// Tên shop thay cho {shop}: theo Mã gian (bảng camon_shop_names trong storage, vd { BCE: "BEST CHOICE STORE" }),
// không có thì lấy tên shop đang đăng nhập Kênh Người Bán
let shopNameCache = "";
async function getShopName() {
  if (shopNameCache) return shopNameCache;
  try {
    const st = await chrome.storage.local.get(["camon_shop_names", "tcdd-shop-code", "maGian", "dhHoanTextValue"]);
    const code = String(st["tcdd-shop-code"] || st.maGian || st.dhHoanTextValue || "").trim().toUpperCase();
    if (code && st.camon_shop_names && st.camon_shop_names[code]) return (shopNameCache = st.camon_shop_names[code]);
  } catch (e) { /* bỏ qua */ }
  try {
    const res = await fetch("/api/selleraccount/shop_info/", { credentials: "include" });
    const j = await res.json();
    shopNameCache = (j && j.data && (j.data.name || j.data.shop_name)) || "";
  } catch (e) { /* bỏ qua */ }
  return shopNameCache || "shop";
}

function buildMessage(buyer, product, status, shop) {
  const seed = hash(buyer + Date.now().toString().slice(0, -5));
  const xung = "anh/chị";
  const sp = product ? shortName(product) : "sản phẩm của shop";
  const tipEntry = TIPS.find(([re]) => re.test(product || ""));
  const statusKey = Object.keys(STATUS).find((k) => status && status.includes(k)) || "_";
  const parts = [
    pick(OPENERS, seed),
    pick(STATUS[statusKey], seed >> 3),
    tipEntry ? pick(tipEntry[1], seed >> 5) : "",
    pick(CLOSERS, seed >> 7),
  ];
  return parts.filter(Boolean).join(" ").replaceAll("{xung}", xung).replaceAll("{sp}", sp).replaceAll("{shop}", shop || "shop");
}

// Đọc thông tin đơn từ thẻ đơn hàng chứa header
function orderInfo(header) {
  const card = header.closest('[class*="order-card"]:not(.order-card-header)') || header.parentElement;
  const lines = (card?.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const buyer = lines[0] || "";
  const idx = lines.findIndex((l) => l.startsWith("Mã đơn hàng"));
  let product = lines.slice(idx + 1).find((l) => l.length > 15 && !/^Variation|^x\d|^₫|Quà tặng/.test(l)) || "";
  // Extension chính chèn nút copy "C" ngay trước tên sản phẩm (innerText dính thành "CNồi…"): bỏ đúng 1 chữ C đó
  // Chỉ bỏ khi trong thẻ có đúng 1 phần tử chứa tên không có chữ C đầu (tránh làm mất C thật như "Chảo")
  if (/^C\S/.test(product) && [...(card?.querySelectorAll("*") || [])].some((el) => !el.children.length && el.textContent.trim() === product.slice(1).trim())) product = product.slice(1);
  const status = lines.find((l) => /Chờ lấy hàng|Đang giao|Đã giao|Đã giao cho ĐVVC/.test(l)) || "";
  return { buyer, product, status };
}

function setTextareaValue(ta, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
}

async function waitFor(fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// Tìm textarea của khung chat đang mở cho đúng người mua
function findChatBox(buyer) {
  const areas = [...document.querySelectorAll("textarea")].filter((t) => t.offsetParent);
  for (const ta of areas) {
    let p = ta;
    for (let i = 0; i < 15 && p; i++) {
      p = p.parentElement;
      if (p && p.innerText && p.innerText.includes(buyer.replace(/\.\.$/, ""))) return ta;
    }
  }
  return null;
}

async function onClick(btn, header) {
  const { buyer, product, status } = orderInfo(header);
  const chatBtn = header.querySelector(".buyer-chat-action");
  if (!chatBtn) return alert("Không tìm thấy nút chat của đơn này.");
  btn.textContent = "⏳ Đang mở chat...";
  chatBtn.click();
  const ta = await waitFor(() => findChatBox(buyer));
  if (!ta) {
    btn.textContent = "💚 Cảm ơn";
    return alert("Không mở được khung chat với " + buyer + ". Thử bấm lại nhé.");
  }
  const msg = buildMessage(buyer, product, status, await getShopName());
  setTextareaValue(ta, msg);
  if (AUTO_SEND) {
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  }
  btn.textContent = AUTO_SEND ? "✅ Đã gửi" : "✍️ Đã soạn – bấm Enter";
  btn.classList.add("tc-done");
}

function addButtons() {
  document.querySelectorAll(".order-card-header").forEach((header) => {
    if (header.querySelector(".tc-thanks-btn")) return;
    const anchor = header.querySelector(".buyer-chat-action") || header.querySelector(".buyer-info");
    if (!anchor) return;
    const btn = document.createElement("button");
    btn.className = "tc-thanks-btn";
    btn.type = "button";
    btn.textContent = "💚 Cảm ơn";
    btn.title = "Mở chat và soạn sẵn lời cảm ơn cho khách này";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn, header);
    });
    anchor.insertAdjacentElement("afterend", btn);
  });
}

new MutationObserver(addButtons).observe(document.body, { childList: true, subtree: true });
addButtons();
