// 卡片字段集中配置：增删卡面字段时优先调整这里。
export const CARD_FIELDS = ["type", "year", "platforms"];
const FALLBACK_IMAGE = "./assets/img/placeholder.png";

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

export function renderCard(item) {
  const meta = CARD_FIELDS.filter(key => key !== "platforms").map(key => {
    const value = item[key];
    return value ? `<span>${escapeHtml(value)}</span>` : "";
  }).join("");

  const platformName = (item.platforms || []).join(" / ") || "平台待定";

  const platforms = CARD_FIELDS.includes("platforms")
  ? `<p class="card__platform card__meta"><span>${escapeHtml(platformName)}</span>${item.event ? `<span>${escapeHtml(item.event)}</span>` : ""}</p>`
  : "";

  // 单独读取尺寸，没有填写时显示提示
  const size = String(item.size || "").trim();

  return `<button class="card" type="button" data-goods-id="${escapeHtml(item.id)}" aria-label="查看${escapeHtml(item.name)}详情">
    <div class="card__media">
      <span class="badge badge--${statusClass(item.status)}">${escapeHtml(item.status)}</span>
      ${renderImage({ src: item.image, alt: item.name, className: "card__img", width: 600, height: 600 })}
    </div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(item.name)}</h3>
      <p class="card__size" title="${escapeHtml(size)}">${escapeHtml(size || "尺寸待补充")}</p>
      <div class="card__meta">${meta}</div>
      ${platforms}
    </div>
  </button>`;
}

export function renderModal(item) {
  const rows = [
    ["柄图系列", item.seriesName], ["制品类型", item.type], ["发售平台", (item.platforms || []).join(" / ")],
    ["活动", item.event], ["发售年份", item.year], ["具体发售日", item.date],
    ["日元定价", item.price ? `¥${Number(item.price).toLocaleString("ja-JP")}` : ""], ["发售性质", item.release_type],
    ["尺寸", item.size], ["材质", item.material]
  ];
  const details = rows.map(([label, value]) => `<div class="detail-list__row"><dt>${label}</dt><dd>${escapeHtml(value || "待补充")}</dd></div>`).join("");
  const note = `<div class="detail-list__row detail-list__row--full"><dt>备注</dt><dd>${escapeHtml(item.note || "暂无备注")}</dd></div>`;
  return `${renderImage({ src: item.image, alt: `${item.name}详情图`, className: "lightbox__img", width: 1200, mode: "contain" })}
    <div class="lightbox__body"><p class="lightbox__series">${escapeHtml(item.seriesName || "未分系列")}</p><h2 id="modal-title" class="lightbox__title">${escapeHtml(item.name)}</h2><span class="badge lightbox__status badge--${statusClass(item.status)}">${escapeHtml(item.status)}</span><dl class="detail-list">${details}${note}</dl></div>`;
}
