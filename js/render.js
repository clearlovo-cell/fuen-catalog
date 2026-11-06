```javascript
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

function renderPersonalAction(kind, active) {
  const owned = kind === "owned";
  const label = active ? (owned ? "已入库" : "已加入心愿") : (owned ? "入库" : "心愿");
  const hint = active ? "再次点击可移除" : (owned ? "加入个人仓库" : "加入个人心愿单");
  return `<button class="personal-action" type="button" data-personal-action="${kind}" aria-pressed="${active}"><span>${label}</span><small>${hint}</small></button>`;
}

export function renderModal(item, personal = { owned: false, wishlist: false }) {
  const rows = [
    ["柄图系列", item.seriesName], ["制品类型", item.type], ["发售平台", (item.platforms || []).join(" / ")],
    ["活动", item.event], ["发售年份", item.year], ["具体发售日", item.date],
    ["日元定价", item.price ? `¥${Number(item.price).toLocaleString("ja-JP")}` : ""], ["发售性质", item.release_type],
    ["尺寸", item.size], ["材质", item.material]
  ];
  const details = rows.map(([label, value]) => `<div class="detail-list__row"><dt>${label}</dt><dd>${escapeHtml(value || "待补充")}</dd></div>`).join("");
  const note = `<div class="detail-list__row detail-list__row--full"><dt>备注</dt><dd>${escapeHtml(item.note || "暂无备注")}</dd></div>`;
  const actions = `<div class="modal-actions" aria-label="个人列表操作">${renderPersonalAction("owned", personal.owned)}${renderPersonalAction("wishlist", personal.wishlist)}</div>`;
  return `${renderImage({ src: item.image, alt: `${item.name}详情图`, className: "lightbox__img", width: 1200, mode: "contain" })}
    <div class="lightbox__body"><p class="lightbox__series">${escapeHtml(item.seriesName || "未分系列")}</p><h2 id="modal-title" class="lightbox__title">${escapeHtml(item.name)}</h2><span class="badge lightbox__status badge--${statusClass(item.status)}">${escapeHtml(item.status)}</span><dl class="detail-list">${details}${note}</dl>${actions}</div>`;
}
```

### 新增：`js/storage.js`

```javascript
const STORAGE_KEY = "fuen-catalog:personal:v1";
const BACKUP_TYPE = "fuen-catalog-backup";
const VERSION = 1;
const KINDS = ["owned", "wishlist"];

const emptyData = () => ({ version: VERSION, owned: {}, wishlist: {} });
const now = () => new Date().toISOString();

function normalizeRecord(value) {
  const result = {};
  if (Array.isArray(value)) {
    value.forEach(id => {
      const key = String(id || "").trim();
      if (key && key.length <= 128) result[key] = "";
    });
    return result;
  }
  if (!value || typeof value !== "object") return result;
  Object.entries(value).forEach(([rawId, rawDate]) => {
    const id = String(rawId || "").trim();
    if (!id || id.length > 128) return;
    result[id] = typeof rawDate === "string" ? rawDate : "";
  });
  return result;
}

function normalize(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: VERSION,
    owned: normalizeRecord(source.owned),
    wishlist: normalizeRecord(source.wishlist)
  };
}

let storageAvailable = true;
let data = emptyData();
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) data = normalize(JSON.parse(saved));
} catch (error) {
  storageAvailable = false;
  console.warn("本地仓库暂时无法读取", error);
}

const listeners = new Set();
function notify() {
  listeners.forEach(listener => listener());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    storageAvailable = true;
    return true;
  } catch (error) {
    storageAvailable = false;
    console.warn("本地仓库暂时无法保存", error);
    return false;
  }
}

function assertKind(kind) {
  if (!KINDS.includes(kind)) throw new Error("未知的个人列表类型");
}

export function hasItem(kind, id) {
  assertKind(kind);
  return Object.hasOwn(data[kind], String(id));
}

export function getIds(kind) {
  assertKind(kind);
  return Object.keys(data[kind]);
}

export function isStorageAvailable() {
  return storageAvailable;
}

export function toggleItem(kind, id) {
  assertKind(kind);
  const key = String(id || "").trim();
  if (!key) throw new Error("制品 ID 不能为空");
  const added = !Object.hasOwn(data[kind], key);
  const nextRecord = { ...data[kind] };
  if (added) nextRecord[key] = now();
  else delete nextRecord[key];
  data = { ...data, [kind]: nextRecord };
  const persisted = persist();
  notify();
  return { added, persisted };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createBackup() {
  return {
    type: BACKUP_TYPE,
    version: VERSION,
    exportedAt: now(),
    owned: { ...data.owned },
    wishlist: { ...data.wishlist }
  };
}

function mergeRecords(current, incoming) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([id, date]) => {
    if (!Object.hasOwn(merged, id) || !merged[id]) {
      merged[id] = date || now();
      return;
    }
    const currentTime = Date.parse(merged[id]);
    const incomingTime = Date.parse(date);
    if (Number.isFinite(incomingTime) && (!Number.isFinite(currentTime) || incomingTime > currentTime)) {
      merged[id] = date;
    }
  });
  return merged;
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.type !== BACKUP_TYPE) throw new Error("这不是斐恩图鉴的备份文件");
  if (Number(parsed.version) > VERSION) throw new Error("备份版本较新，请先更新网站");
  const incoming = normalize(parsed);
  data = {
    version: VERSION,
    owned: mergeRecords(data.owned, incoming.owned),
    wishlist: mergeRecords(data.wishlist, incoming.wishlist)
  };
  if (!persist()) throw new Error("浏览器未允许本地保存，请检查隐私或存储设置");
  notify();
  return { owned: getIds("owned").length, wishlist: getIds("wishlist").length };
}

window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  try {
    data = event.newValue ? normalize(JSON.parse(event.newValue)) : emptyData();
    storageAvailable = true;
    notify();
  } catch (error) {
    console.warn("忽略了另一标签页中的无效本地数据", error);
  }
});
```
