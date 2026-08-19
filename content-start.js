// content-start.js
// Chạy ở document_start để bắt ngay các API call đầu tiên

window.splqInterceptedApiData = {}; 
window.splqInterceptedByProduct = {}; 

window.addEventListener('message', (e) => {
  if (!e.data || e.data.channel !== 'SPLQ_FETCH_INTERCEPTED') return;
  const { url, headers, data } = e.data;
  if (!url || !data) return;

  // Lưu vào cache
  window.splqInterceptedApiData[url] = { url, headers, data };

  // Lấy itemId và shopId (hỗ trợ nhiều định dạng trả về của Shopee)
  let itemId, shopId;
  if (data?.data?.item?.item_id) {
    itemId = data.data.item.item_id;
    shopId = data.data.item.shop_id;
  } else if (data?.item?.item_id) {
    itemId = data.item.item_id;
    shopId = data.item.shop_id;
  } else if (data?.data?.item_id) {
    itemId = data.data.item_id;
    shopId = data.data.shop_id;
  }

  if (itemId && shopId) {
    const key = `${itemId}-${shopId}`;
    if (!window.splqInterceptedByProduct[key]) window.splqInterceptedByProduct[key] = [];
    window.splqInterceptedByProduct[key].push({ url, headers, data });
  }
});
