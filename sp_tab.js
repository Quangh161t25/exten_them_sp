(function () {
  const readButton = document.getElementById("btn-read-current-sp");
  const copyButton = document.getElementById("btn-copy-current-sp");
  const saveWebButton = document.getElementById("btn-save-current-sp-web");
  const status = document.getElementById("current-sp-status");
  const tbody = document.querySelector("#table-current-sp tbody");

  if (!readButton || !copyButton || !tbody) return;

  const imageColumns = new Set(["mainImageLinks", "descriptionImageLinks", "variationImageLinks"]);
  const linkColumns = new Set(["videoLinks"]);
  const columns = [
    { key: "itemId", label: "Item ID" },
    { key: "sku", label: "SKU" },
    { key: "variationName", label: "Phan loai" },
    { key: "productName", label: "Ten" },
    { key: "category", label: "Nganh hang" },
    { key: "description", label: "Mo ta" },
    { key: "mainImageLinks", label: "Anh chinh" },
    { key: "descriptionImageLinks", label: "Anh mo ta" },
    { key: "variationImageLinks", label: "Anh phan loai" },
    { key: "videoLinks", label: "Video" }
  ];

  let latestRows = [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeCellForCopy(value) {
    return String(value || "")
      .replace(/\t/g, " ")
      .trim();
  }

  function shortCell(value, max = 180) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function splitImageLinks(value) {
    return String(value || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function renderImageCell(value) {
    const links = splitImageLinks(value);

    if (!links.length) return "";

    const visibleLinks = links.slice(0, 6);
    const moreCount = links.length - visibleLinks.length;
    const thumbs = visibleLinks.map((link) => `
      <a class="sp-image-thumb" href="${escapeHtml(link)}" target="_blank" rel="noreferrer" title="${escapeHtml(link)}">
        <img src="${escapeHtml(link)}" loading="lazy" alt="Anh SP">
      </a>
    `).join("");

    return `<div class="sp-image-grid">${thumbs}${moreCount > 0 ? `<span class="sp-image-more">+${moreCount}</span>` : ""}</div>`;
  }

  function renderLinkCell(value) {
    const links = splitImageLinks(value);
    if (!links.length) return "";
    return links.map((link, index) => `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer" title="${escapeHtml(link)}">Video ${index + 1}</a>`).join("<br>");
  }

  function renderRows(rows) {
    latestRows = Array.isArray(rows) ? rows : [];

    if (!latestRows.length) {
      tbody.innerHTML = `<tr><td colspan="${columns.length}" style="text-align: center; padding: 10px; color: #ef4444;">Khong co du lieu.</td></tr>`;
      return;
    }

    tbody.innerHTML = latestRows.map((row) => `
      <tr>
        ${columns.map((col) => {
          const value = row[col.key] || "";
          if (imageColumns.has(col.key)) {
            return `<td title="${escapeHtml(value)}" class="sp-image-cell">${renderImageCell(value)}</td>`;
          }
          if (linkColumns.has(col.key)) {
            return `<td title="${escapeHtml(value)}" class="sp-text-cell">${renderLinkCell(value)}</td>`;
          }

          const shown = shortCell(value, col.key === "description" ? 140 : 80);
          return `<td title="${escapeHtml(value)}" class="sp-text-cell">${escapeHtml(shown)}</td>`;
        }).join("")}
      </tr>
    `).join("");
  }

  function rowsToTsv(rows) {
    const headerLine = columns.map((col) => col.label).join("\t");
    const bodyLines = rows.map((row) => columns.map((col) => normalizeCellForCopy(row[col.key])).join("\t"));
    return [headerLine, ...bodyLines].join("\n");
  }

  function getStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
  }

  function makeWebSpId(index) {
    const now = new Date();
    const pad = (value, size = 2) => String(value).padStart(size, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
      pad(index + 1, 3)
    ].join("");
  }

  async function getCurrentMaGian() {
    const inputValue = document.getElementById("dh-hoan-text")?.value?.trim();
    if (inputValue) return inputValue;

    const storage = await getStorage(["maGian", "dhHoanTextValue"]);
    return String(storage.maGian || storage.dhHoanTextValue || "").trim();
  }

  async function getWebShopeeByMaGian(maGian) {
    if (!maGian) return "";
    try {
      const res = await sendRuntimeMessage({ type: "FETCH_CAI_DAT" });
      if (res && res.ok && res.values && res.values.length > 0) {
        const rows = res.values;
        const headers = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
        let gianIdx = headers.findIndex(h => h === "gian" || h === "ma gian" || h === "mã gian" || h === "ma_gian");
        if (gianIdx === -1) gianIdx = 1; // Cột B (index 1)

        let webShopeeIdx = headers.findIndex(h => h === "web_shopee" || h === "web shopee" || h.includes("web_shopee") || h.includes("web shopee"));
        if (webShopeeIdx === -1) webShopeeIdx = 6; // Cột G (index 6)

        const targetGian = maGian.trim().toLowerCase();
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowGian = String(row[gianIdx] || "").trim().toLowerCase();
          if (rowGian && rowGian === targetGian) {
            const webShopee = String(row[webShopeeIdx] || "").trim();
            if (webShopee) return webShopee;
          }
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc sheet cai_dat để lấy web_shopee:", e);
    }
    return "";
  }

  async function rowsToWebSpValues(rows, maGian) {
    const webShopee = await getWebShopeeByMaGian(maGian);

    return rows.map((row, index) => {
      const itemId = normalizeCellForCopy(row.itemId);
      let linkShopee = "";
      if (webShopee && itemId) {
        linkShopee = `https://shopee.vn/product/${webShopee}/${itemId}`;
      } else if (row.linkShopee) {
        linkShopee = normalizeCellForCopy(row.linkShopee);
      } else if (itemId) {
        linkShopee = `https://banhang.shopee.vn/portal/product/${itemId}`;
      }

      return [
        makeWebSpId(index),
        maGian,
        normalizeCellForCopy(row.sku),
        normalizeCellForCopy(row.variationName),
        normalizeCellForCopy(row.productName),
        normalizeCellForCopy(row.category),
        normalizeCellForCopy(row.description),
        normalizeCellForCopy(row.mainImageLinks),
        normalizeCellForCopy(row.descriptionImageLinks),
        normalizeCellForCopy(row.variationImageLinks),
        normalizeCellForCopy(row.videoLinks),
        "",
        "",
        itemId,
        linkShopee
      ];
    });
  }

  readButton.addEventListener("click", async () => {
    readButton.disabled = true;
    status.textContent = "Dang doc SP...";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/portal/product/")) {
        throw new Error("Hay mo trang sua san pham banhang.shopee.vn/portal/product/... truoc.");
      }

      const response = await sendMessageToTab(tab.id, { type: "EXTRACT_SELLER_SP_FULL" });
      if (!response?.ok) {
        throw new Error(response?.error || response?.message || "Khong doc duoc SP.");
      }

      const maGian = await getCurrentMaGian();
      const webShopee = await getWebShopeeByMaGian(maGian);
      if (webShopee && response.rows) {
        response.rows.forEach(row => {
          if (row.itemId) {
            row.linkShopee = `https://shopee.vn/product/${webShopee}/${row.itemId}`;
          }
        });
      }

      renderRows(response.rows || []);
      const rowCount = (response.rows || []).length;
      const mainCount = (response.mainImages || []).length;
      const descCount = (response.descriptionImages || []).length;
      const variationCount = (response.rows || []).filter((row) => row.variationImageLinks).length;
      const videoCount = (response.videos || []).length;
      status.textContent = `Da doc ${rowCount} dong SKU. Anh chinh: ${mainCount}. Anh mo ta: ${descCount}. Anh phan loai: ${variationCount}. Video: ${videoCount}.`;
    } catch (error) {
      renderRows([]);
      status.textContent = `Loi: ${error.message}`;
    } finally {
      readButton.disabled = false;
    }
  });


  saveWebButton?.addEventListener("click", async () => {
    if (!latestRows.length) {
      status.textContent = "Chua co du lieu de luu WEB_SP.";
      return;
    }

    saveWebButton.disabled = true;
    status.textContent = "Dang luu WEB_SP...";

    try {
      const maGian = await getCurrentMaGian();
      if (!maGian) throw new Error("Chua co ma gian trong tab Cai dat.");

      const values = await rowsToWebSpValues(latestRows, maGian);
      const response = await sendRuntimeMessage({ type: "SAVE_WEB_SP", values });
      if (!response?.ok) throw new Error(response?.error || "Khong luu duoc WEB_SP.");

      status.textContent = `Da luu ${response.count || values.length} dong vao WEB_SP.`;
    } catch (error) {
      status.textContent = `Loi luu WEB_SP: ${error.message}`;
    } finally {
      saveWebButton.disabled = false;
    }
  });
  copyButton.addEventListener("click", async () => {
    if (!latestRows.length) {
      status.textContent = "Chua co du lieu de copy.";
      return;
    }

    await navigator.clipboard.writeText(rowsToTsv(latestRows));
    status.textContent = `Da copy ${latestRows.length} dong TSV.`;
  });
})();