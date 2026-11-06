import { filterGoods, splitMaterials, uniqueValues } from "./filter.js";
import { bindImageFallbacks, escapeHtml, renderCard, renderImage, renderModal } from "./render.js";

const emptyFilters = () => ({ seriesId: "", type: "", platforms: [], event: "", year: "", release_type: "", search: "", materials: [], hasSize: false });
const state = { goods: [], series: [], filters: emptyFilters(), loaded: false, reverse: false };
// 前端下拉菜单的自定义显示顺序
const filterOrders = {
  type: [ "吧唧", "立牌", "透卡", "色纸", "挂件", "相卡", "拍立得", "留言卡", "ID卡", "书签", "镭射票", "珠光卡", "杂志", "杯垫", "其他"],
  platforms: [ "Otomate", "Joyoland", "StellaWorth", "Alice", "Ebten", "oioi", "Wondergoo", "Neowing", "Gamecity", "Trader", "Challe", "B's-log", "Coolb", "宝岛", "乐天", "Trangle Teezer", "Lovaroma", "其他"],
  event: [
    "本篇店特", "FD店特", "本篇繁中限定", "FD繁中限定", "夏市", "秋风", "冬市", "甜品趴", "OTP", "AGF", "亚洲限定", "联名", "其他"],
  materials: ["马口铁", "亚克力", "纸", "PET", "涤纶", "其他"]
};

// 按指定数组排序；未指定的选项排在最后
function sortByCustomOrder(values, order) {
  const rank = new Map(order.map((value, index) => [value, index]));

  return [...values].sort((a, b) => {
    const aIndex = rank.get(a) ?? order.length;
    const bIndex = rank.get(b) ?? order.length;

    if (aIndex !== bIndex) return aIndex - bIndex;

    // 两个选项都没有指定顺序时，保持按名称排序
    return a.localeCompare(b, "zh-CN", { numeric: true });
  });
}
const $ = selector => document.querySelector(selector);
const els = {
  rail: $("#series-rail"), grid: $("#goods-grid"), total: $("#total-count"), result: $("#result-count"), catalogTitle: $("#catalog-title"),
  loading: $("#loading-state"), error: $("#error-state"), empty: $("#empty-state"), search: $("#search-input"), reset: $("#reset-filters"),
  panel: $("#filters-panel"), toggle: $("#filters-toggle"), filterCount: $("#filter-count"), moreFilters: $("#more-filters"),
  materialChips: $("#material-chips"), materialMore: $("#material-more"), materialField: $("#material-field"), sizeField: $("#size-field"),
  size: $("#filter-size"), overlay: $("#lightbox-overlay"), modal: $("#lightbox"), modalContent: $("#modal-content"), modalClose: $("#modal-close"),
  orderToggle: $("#reverse-order"), fab: $("#back-to-top"), fabBottom: $("#go-to-bottom")
};
const desktopQuery = window.matchMedia("(min-width: 768px)");
let lastFocusedElement = null;
let modalTimer;

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const data = await res.json();
    
    // 兼容 CMS 保存的对象格式 { goods: [...] } 或 { series: [...] }
    if (Array.isArray(data)) {
        return data;
    }
    
    if (data && typeof data === 'object') {
        if (url.includes('goods') && Array.isArray(data.goods)) {
            return data.goods;
        }
        if (url.includes('series') && Array.isArray(data.series)) {
            return data.series;
        }
        // 兜底：找第一个数组属性
        const arr = Object.values(data).find(v => Array.isArray(v));
        if (arr) return arr;
    }
    
    throw new Error(`${url}: 数据格式应为数组`);
}

async function loadData() {
  els.loading.hidden = false;
  els.error.hidden = true;
  els.empty.hidden = true;
  els.grid.hidden = true;
  try {
    const [goods, series] = await Promise.all([fetchJson("./data/goods.json"), fetchJson("./data/series.json")]);
    state.series = series.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const seriesMap = new Map(state.series.map(item => [item.slug, item.name]));
    state.goods = goods.map((item, index) => ({ ...item, id: item.id || `goods-${index}`, seriesName: seriesMap.get(item.series) || item.series }));
    state.loaded = true;
    els.orderToggle.disabled = false;
    els.total.textContent = String(state.goods.length);
    initialiseFilters();
    renderSeriesRail();
    applyFilters();
  } catch (error) {
    console.error("图鉴数据加载失败", error);
    els.loading.hidden = true;
    els.error.hidden = false;
    els.grid.hidden = true;
    els.result.textContent = "暂时无法读取数据";
  }
}

function fillSelect(key, values) {
  const select = document.querySelector(`[data-filter="${key}"]`);
  if (!select) return;
  const field = select.closest(".field");
  field.hidden = values.length === 0;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function initialiseFilters() {
  fillSelect("type", sortByCustomOrder(uniqueValues(state.goods, "type"), filterOrders.type));
  fillSelect("platforms", sortByCustomOrder(uniqueValues(state.goods, "platforms"), filterOrders.platforms));
  fillSelect("year", uniqueValues(state.goods, "year").reverse());
  fillSelect("event", sortByCustomOrder(uniqueValues(state.goods, "event"), filterOrders.event));
  fillSelect("release_type", uniqueValues(state.goods, "release_type"));

  const materials = sortByCustomOrder([...new Set(state.goods.flatMap(item => splitMaterials(item.material)))], filterOrders.materials);
  els.materialField.hidden = materials.length === 0;
  els.materialChips.innerHTML = materials.map(material => `<button class="material-chip" type="button" data-material="${escapeHtml(material)}" aria-pressed="false">${escapeHtml(material)}</button>`).join("");
  els.sizeField.hidden = !state.goods.some(item => String(item.size || "").trim());
  updateMoreFiltersVisibility();
  requestAnimationFrame(updateMaterialMoreVisibility);
}

function renderSeriesRail() {
  const allIcon = `<span class="rail__cover rail__cover--all"><svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="16" cy="9" rx="4" ry="8"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(72 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(144 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(216 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(288 16 16)"/></g></svg></span>`;
  const allButton = `<button class="rail__item" type="button" data-series="" aria-pressed="${state.filters.seriesId === ""}">${allIcon}<span class="rail__name">全部</span></button>`;
  const items = state.series.map(series => `<button class="rail__item" type="button" data-series="${escapeHtml(series.slug)}" aria-pressed="${state.filters.seriesId === series.slug}" title="${escapeHtml(series.note || series.name)}">
    ${renderImage({ src: series.cover, alt: "", className: "rail__cover", width: 160, height: 160 })}<span class="rail__name">${escapeHtml(series.name)}</span></button>`).join("");
  els.rail.innerHTML = `<div class="rail__track">${allButton}${items}</div>`;
  bindImageFallbacks(els.rail);
}

function applyFilters() {
  if (!state.loaded) return;
  const filtered = filterGoods(state.goods, state.filters);
  const orderedGoods = state.reverse ? [...filtered].reverse() : filtered;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.grid.hidden = filtered.length === 0;
  els.empty.hidden = filtered.length !== 0;
  els.grid.innerHTML = orderedGoods.map(renderCard).join("");
  bindImageFallbacks(els.grid);
  const selectedSeries = state.series.find(item => item.slug === state.filters.seriesId);
  els.catalogTitle.textContent = selectedSeries ? selectedSeries.name : "全部谷子";
  els.result.textContent = `找到 ${filtered.length} 件谷子${state.reverse ? " · 已倒序" : ""}`;
  updateFilterIndicators();
  requestAnimationFrame(updateScrollButtons);
}

function activeFilterCount() {
  const f = state.filters;
  return [f.seriesId, f.type, f.event, f.year, f.release_type, f.search, f.hasSize].filter(Boolean).length + f.platforms.length + f.materials.length;
}

function updateFilterIndicators() {
  const count = activeFilterCount();
  els.filterCount.hidden = count === 0;
  els.filterCount.textContent = String(count);
  els.reset.hidden = count === 0;
}

function resetFilters() {
  state.filters = emptyFilters();
  els.search.value = "";
  els.size.checked = false;
  document.querySelectorAll("[data-filter]").forEach(select => { select.value = ""; });
  els.materialChips.querySelectorAll("[data-material]").forEach(chip => chip.setAttribute("aria-pressed", "false"));
  renderSeriesRail();
  applyFilters();
}

function updateMoreFiltersVisibility() {
  const hasVisibleExtras = [...els.panel.querySelectorAll(".filters-extra")].some(field => !field.hidden);
  els.moreFilters.hidden = desktopQuery.matches || els.panel.dataset.expanded !== "true" || !hasVisibleExtras;
}

function updateMaterialMoreVisibility() {
  if (els.materialField.hidden || !els.materialChips.children.length) {
    els.materialMore.hidden = true;
    return;
  }
  const wasExpanded = els.materialChips.classList.contains("is-expanded");
  if (wasExpanded) els.materialChips.classList.remove("is-expanded");
  els.materialMore.hidden = els.materialChips.scrollHeight <= els.materialChips.clientHeight + 2;
  if (wasExpanded) els.materialChips.classList.add("is-expanded");
}

/** 打开详情并管理焦点；浮层内只有必需的关闭按钮。 */
function openModal(id) {
  const item = state.goods.find(goods => String(goods.id) === String(id));
  if (!item) return;
  clearTimeout(modalTimer);
  lastFocusedElement = document.activeElement;
  els.modalContent.innerHTML = renderModal(item);
  bindImageFallbacks(els.modalContent);
  els.overlay.hidden = false;
  document.body.classList.add("is-modal-open");
  els.modal.scrollTop = 0;
  requestAnimationFrame(() => {
    els.overlay.classList.add("is-open");
    els.modalClose.focus();
  });
}

function closeModal() {
  if (els.overlay.hidden) return;
  els.overlay.classList.remove("is-open");
  document.body.classList.remove("is-modal-open");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
  modalTimer = window.setTimeout(() => {
    els.overlay.hidden = true;
    els.modalContent.innerHTML = "";
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  }, delay);
}

els.rail.addEventListener("click", event => {
  const button = event.target.closest("[data-series]");
  if (!button) return;
  state.filters.seriesId = button.dataset.series;
  els.rail.querySelectorAll("[data-series]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  applyFilters();
});

els.search.addEventListener("input", () => { state.filters.search = els.search.value; applyFilters(); });
document.querySelectorAll("[data-filter]").forEach(select => {
  select.addEventListener("change", () => {
    const key = select.dataset.filter;
    state.filters[key] = key === "platforms" ? (select.value ? [select.value] : []) : select.value;
    applyFilters();
  });
});
els.size.addEventListener("change", () => { state.filters.hasSize = els.size.checked; applyFilters(); });
els.materialChips.addEventListener("click", event => {
  const chip = event.target.closest("[data-material]");
  if (!chip) return;
  const value = chip.dataset.material;
  const selected = state.filters.materials.includes(value);
  state.filters.materials = selected ? state.filters.materials.filter(item => item !== value) : [...state.filters.materials, value];
  chip.setAttribute("aria-pressed", String(!selected));
  applyFilters();
});
els.materialMore.addEventListener("click", () => {
  const expanded = els.materialChips.classList.toggle("is-expanded");
  els.materialMore.setAttribute("aria-expanded", String(expanded));
  els.materialMore.textContent = expanded ? "收起材质" : "展开更多";
});
els.toggle.addEventListener("click", () => {
  const expanded = els.toggle.getAttribute("aria-expanded") !== "true";
  els.toggle.setAttribute("aria-expanded", String(expanded));
  els.panel.dataset.expanded = String(expanded);
  updateMoreFiltersVisibility();
});
els.moreFilters.addEventListener("click", () => {
  const expanded = !els.panel.classList.contains("show-all");
  els.panel.classList.toggle("show-all", expanded);
  els.moreFilters.setAttribute("aria-expanded", String(expanded));
  els.moreFilters.firstChild.textContent = expanded ? "收起更多筛选" : "展开更多筛选";
  requestAnimationFrame(updateMaterialMoreVisibility);
});
els.reset.addEventListener("click", resetFilters);
$("#empty-reset").addEventListener("click", resetFilters);
$("#retry-load").addEventListener("click", loadData);
els.grid.addEventListener("click", event => {
  const card = event.target.closest("[data-goods-id]");
  if (card) openModal(card.dataset.goodsId);
});
els.modalClose.addEventListener("click", closeModal);
els.overlay.addEventListener("click", event => { if (event.target === els.overlay) closeModal(); });
document.addEventListener("keydown", event => {
  if (els.overlay.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeModal(); }
  if (event.key === "Tab") {
    // 详情中仅有关闭按钮可聚焦，因此焦点始终留在浮层内。
    event.preventDefault();
    els.modalClose.focus();
  }
});
const getScrollBehavior = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
els.orderToggle.addEventListener("click", () => {
  state.reverse = !state.reverse;
  els.orderToggle.setAttribute("aria-pressed", String(state.reverse));
  els.orderToggle.setAttribute("aria-label", state.reverse ? "关闭倒序查看，恢复正序" : "开启倒序查看");
  els.orderToggle.title = state.reverse ? "恢复当前图鉴列表的正序排列" : "将当前图鉴列表倒序排列";
  els.orderToggle.querySelector("span").textContent = state.reverse ? "顺" : "逆";
  applyFilters();
});
els.fab.addEventListener("click", () => window.scrollTo({ top: 0, behavior: getScrollBehavior() }));
els.fabBottom.addEventListener("click", () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: getScrollBehavior() }));

function updateScrollButtons() {
  const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  els.fab.classList.toggle("is-visible", window.scrollY > 300);
  els.fabBottom.classList.toggle("is-visible", maxScrollTop > 100 && window.scrollY < maxScrollTop - 100);
}
window.addEventListener("scroll", updateScrollButtons, { passive: true });
updateScrollButtons();
window.addEventListener("resize", () => requestAnimationFrame(() => { updateMoreFiltersVisibility(); updateMaterialMoreVisibility(); updateScrollButtons(); }));
desktopQuery.addEventListener("change", updateMoreFiltersVisibility);

$("#current-year").textContent = String(new Date().getFullYear());
loadData();

// === 柄图系列：电脑端鼠标拖拽滚动 ===
(function () {
  const rail = document.getElementById('series-rail');
  if (!rail) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  rail.addEventListener('mousedown', (e) => {
    isDown = true;
    rail.classList.add('active');
    startX = e.pageX - rail.offsetLeft;
    scrollLeft = rail.scrollLeft;
  });

  rail.addEventListener('mouseleave', () => {
    isDown = false;
    rail.classList.remove('active');
  });

  rail.addEventListener('mouseup', () => {
    isDown = false;
    rail.classList.remove('active');
  });

  rail.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - rail.offsetLeft;
    const walk = (x - startX) * 1.5;
    rail.scrollLeft = scrollLeft - walk;
  });
})();
