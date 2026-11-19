// 卡片字段集中配置：增删卡面字段时优先调整这里。
export const CARD_FIELDS = ["type", "year", "platforms"];
const FALLBACK_IMAGE = "./assets/img/placeholder.png";
const amountFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export function formatAmount(value) {
  const amount = Number(value);
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

/** Cloudinary 在 upload 后插入优化参数；本地示意图片保持原路径。 */
export function imgUrl(src, width = 600, height, mode = "fill") {
  if (!src) return FALLBACK_IMAGE;
  const url = String(src);
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const params = [`w_${width}`, height ? `h_${height}` : "", `c_${mode === "contain" ? "fit" : "fill"}`, "f_auto", "q_auto"].filter(Boolean).join(",");
  return url.replace("/upload/", `/upload/${params}/`);
}

/** 所有列表、系列封面和详情图片统一从这里输出。 */
export function renderImage({ src, alt = "", className = "", width = 600, height, mode = "fill", loading = "lazy" }) {
  const url = imgUrl(src, width, height, mode);
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="${escapeHtml(className)}" width="${Number(width)}" height="${Number(height || width)}" loading="${loading}" decoding="async" data-image-fallback>`;
}

/** 使用一次性标记防止兜底图自身失败时循环触发。 */
export function bindImageFallbacks(scope = document) {
  scope.querySelectorAll("img[data-image-fallback]:not([data-error-bound])").forEach(img => {
    img.dataset.errorBound = "true";
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied !== "true") {
        img.dataset.fallbackApplied = "true";
        img.classList.add("is-fallback");
        img.src = imgUrl(FALLBACK_IMAGE, 800, 800, "contain");
        return;
      }
      img.removeAttribute("src");
      img.classList.add("is-fallback");
      console.warn("兜底图片加载失败：", img.alt || "未命名图片");
    });
  });
}

function statusClass(status) {
  return ({ "长期通贩": "onsale", "受付中": "preorder", "受注终了": "ended", "情报公开": "info", "完售": "soldout" })[status] || "soldout";
}

function renderPersonalBadges(owned, wishlist) {
  if (!owned && !wishlist) return "";
  const ownedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h16v11H4zM3 8.5l2-4h14l2 4M9 13.5l2 2 4-4"/></svg>';
  const wishlistIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8C9 4 5 3.5 4 6.5S7 12 12 8zM12 8c3-4 7-4.5 8-1.5S17 12 12 8zM10 11l-3 9 5-3 5 3-3-9"/></svg>';
  return `<span class="card__personal-badges" aria-label="个人状态">
    ${owned ? `<span class="badge badge--owned" title="已入库">${ownedIcon}<span class="sr-only">已入库</span></span>` : ""}
    ${wishlist ? `<span class="badge badge--wishlist" title="已加入心愿单">${wishlistIcon}<span class="sr-only">已加入心愿单</span></span>` : ""}
  </span>`;
}

export function renderCardPrice(record) {
  if (!record || record.price === null) return "";
  return `<strong>${formatAmount(record.price)}<small> 元</small></strong>${record.qty > 1 ? `<span>×${record.qty}</span>` : ""}`;
}

export function renderCard(item, options = {}) {  const meta = CARD_FIELDS.filter(key => key !== "platforms").map(key => {
    const value = item[key];
    return value ? `<span>${escapeHtml(value)}</span>` : "";
  }).join("");
  const platformName = (item.platforms || []).join(" / ") || "平台待定";
  const platforms = CARD_FIELDS.includes("platforms")
    ? `<p class="card__platform card__meta"><span>${escapeHtml(platformName)}</span>${item.event ? `<span>${escapeHtml(item.event)}</span>` : ""}</p>`
    : "";
  const size = String(item.size || "").trim();
  const personalBadges = options.showPersonal ? renderPersonalBadges(options.owned, options.wishlist) : "";
  const priceHtml = options.showPrice ? renderCardPrice(options.priceRecord) : "";
  const price = options.showPrice ? `<div class="card__price" data-card-price${priceHtml ? "" : " hidden"}>${priceHtml}</div>` : "";

  return `<button class="card" type="button" data-goods-id="${escapeHtml(item.id)}" aria-label="查看${escapeHtml(item.name)}详情">
     <div class="card__media">
         <span class="badge badge--${statusClass(item.status)}">${escapeHtml(item.status)}</span>
         ${personalBadges}
         ${renderImage({ src: item.image, alt: item.name, className: "card__img", width: 600, height: 600 })}
         ${price}
    </div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(item.name)}</h3>
      <p class="card__size" title="${escapeHtml(size)}">${escapeHtml(size || "尺寸待补充")}</p>
      <div class="card__meta">${meta}</div>
      ${platforms}
    </div>
  </button>`;
}

function renderPersonalAction(kind, active) {
  const owned = kind === "owned";
  const label = active ? (owned ? "已入库" : "已加入心愿") : (owned ? "入库" : "心愿");
  const hint = active ? "再次点击可移除" : (owned ? "加入个人仓库" : "加入个人心愿单");
  return `<button class="personal-action" type="button" data-personal-action="${kind}" aria-pressed="${active}"><span>${label}</span><small>${hint}</small></button>`;
}

function renderPriceEditor(kind, record) {
  const owned = kind === "owned";
  const title = owned ? "账单" : "预算";
  const price = record?.price;
  const qty = record?.qty || 1;
  return `<section class="price-editor" data-price-editor="${kind}" aria-label="${title}">
    <div class="price-editor__heading"><strong>${title}</strong></div>
    <div class="price-editor__fields">
      <label class="price-field" for="price-${kind}"><span>人民币单价（元）</span><input id="price-${kind}" type="number" inputmode="decimal" min="0" step="any" placeholder="未记录" value="${price === null || price === undefined ? "" : escapeHtml(price)}" data-price-field="price" data-price-kind="${kind}"></label>
      <label class="price-field price-field--qty" for="qty-${kind}"><span>数量</span><input id="qty-${kind}" type="number" inputmode="numeric" min="1" step="1" value="${qty}" data-price-field="qty" data-price-kind="${kind}" required></label>
    </div>
  </section>`;
}

export function renderPriceEditors(personal, priceRecords = {}) {
  return ["owned", "wishlist"].map(kind => personal[kind] ? renderPriceEditor(kind, priceRecords[kind]) : "").join("");
}

export function renderModal(item, personal = { owned: false, wishlist: false }, priceRecords = {}) {
  const rows = [
    ["柄图系列", item.seriesName], ["制品类型", item.type], ["发售平台", (item.platforms || []).join(" / ")],
    ["event", item.event], ["发售年份", item.year], ["具体发售日", item.date],
    ["日元定价", item.price ? `¥${Number(item.price).toLocaleString("ja-JP")}` : ""], ["发售性质", item.release_type],
    ["材质", item.material, true], ["尺寸", item.size, true]
  ];
  const details = rows.map(([label, value, full]) => `<div class="detail-list__row${full ? " detail-list__row--full" : ""}"><dt>${label}</dt><dd>${escapeHtml(value || "待补充")}</dd></div>`).join("");
  const note = `<div class="detail-list__row detail-list__row--full"><dt>备注</dt><dd>${escapeHtml(item.note || "暂无备注")}</dd></div>`;
  const editors = `<div class="price-editors">${renderPriceEditors(personal, priceRecords)}</div>`;
  const actions = `<div class="modal-actions" aria-label="个人列表操作">${renderPersonalAction("owned", personal.owned)}${renderPersonalAction("wishlist", personal.wishlist)}</div>`;
  return `<div class="lightbox__media">
    <button class="modal-nav modal-nav--mobile modal-nav--prev" type="button" data-modal-nav="prev" aria-label="查看上一个制品详情" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
    </button>
    ${renderImage({ src: item.image, alt: `${item.name}详情图`, className: "lightbox__img", width: 1200, mode: "contain" })}
    <button class="modal-nav modal-nav--mobile modal-nav--next" type="button" data-modal-nav="next" aria-label="查看下一个制品详情" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>
    </button>
  </div>
    <div class="lightbox__body"><p class="lightbox__series">${escapeHtml(item.seriesName || "未分系列")}</p><h2 id="modal-title" class="lightbox__title">${escapeHtml(item.name)}</h2><span class="badge lightbox__status badge--${statusClass(item.status)}">${escapeHtml(item.status)}</span><dl class="detail-list">${details}${note}</dl>${editors}${actions}</div>`;
}
