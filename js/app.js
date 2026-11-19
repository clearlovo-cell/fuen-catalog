import { filterGoods, splitMaterials, uniqueValues } from "./filter.js";
import { bindImageFallbacks, escapeHtml, renderCard, renderImage, renderModal } from "./render.js";
import { createBackup, getIds, hasItem, importBackup, isStorageAvailable, subscribe, toggleItem } from "./storage.js";

const emptyFilters = () => ({ seriesId: "", type: "", platforms: [], event: "", year: "", release_type: "", search: "", materials: [], hasSize: false });
const ROUTES = {
  catalog: { title: "茉莉花之炯｜斐恩官周图鉴", listTitle: "全部谷子", subtitle: "ALL GOODS" },
  warehouse: { kind: "owned", title: "已入库｜斐恩官周图鉴", heading: "已入库", listTitle: "仓库", subtitle: "WAREHOUSE", emptyTitle: "仓库还是空的", emptyText: "打开图鉴，把已经拥有的谷子收进来吧。" },
  wishlist: { kind: "wishlist", title: "心愿单｜斐恩官周图鉴", heading: "加入心愿单", listTitle: "心愿单", subtitle: "WISHLIST", emptyTitle: "心愿单还是空的", emptyText: "打开图鉴，把想拥有的谷子加入心愿吧。" }
};
const filterOrders = {
  type: ["吧唧", "立牌", "透卡", "色纸", "挂件", "相卡", "拍立得", "留言卡", "ID卡", "书签", "镭射票", "珠光卡", "杂志", "杯垫", "其他"],
  platforms: ["Otomate", "Joyoland", "StellaWorth", "Alice", "Ebten", "oioi", "Wondergoo", "Neowing", "Gamecity", "Trader", "Challe", "B's-log", "Coolb", "宝岛", "乐天", "Trangle Teezer", "Lovaroma", "其他"],
  event: ["本篇店特", "FD店特", "本篇繁中限定", "FD繁中限定", "夏市", "秋风", "冬市", "甜品趴", "OTP", "AGF", "亚洲限定", "联名", "其他"],
  materials: ["马口铁", "亚克力", "纸", "PET", "涤纶", "其他"]
};

function routeFromHash() {
  const route = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return Object.hasOwn(ROUTES, route) ? route : "catalog";
}

const initialRoute = routeFromHash();
const state = {
  goods: [],
  series: [],
  route: initialRoute,
  filtersByRoute: { catalog: emptyFilters(), warehouse: emptyFilters(), wishlist: emptyFilters() },
  filters: emptyFilters(),
  loaded: false,
  reverse: false
};
state.filters = state.filtersByRoute[initialRoute];

const $ = selector => document.querySelector(selector);
const els = {
  rail: $("#series-rail"), grid: $("#goods-grid"), result: $("#result-count"), catalogTitle: $("#catalog-title"), subtitle: $(".catalog__subtitle"),
  loading: $("#loading-state"), error: $("#error-state"), empty: $("#empty-state"), emptyTitle: $("#empty-title"),
  emptyDescription: $("#empty-description"), emptyReset: $("#empty-reset"), search: $("#search-input"), reset: $("#reset-filters"),
  panel: $("#filters-panel"), toggle: $("#filters-toggle"), toggleLabel: $("#filters-toggle-label"), filterCount: $("#filter-count"), moreFilters: $("#more-filters"), resetDivider: $("#reset-divider"),
  materialChips: $("#material-chips"), materialMore: $("#material-more"), materialField: $("#material-field"), sizeField: $("#size-field"),
  size: $("#filter-size"), overlay: $("#lightbox-overlay"), modal: $("#lightbox"), modalContent: $("#modal-content"), modalClose: $("#modal-close"),
  orderToggle: $("#reverse-order"), fab: $("#back-to-top"), fabBottom: $("#go-to-bottom"),
  catalogHero: $("#catalog-hero"), collectionHero: $("#collection-hero"),
  collectionTitle: $("#collection-title"), collectionCount: $("#collection-count"), collectionTotal: $("#collection-total"),
  collectionProgress: $("#collection-progress"), collectionProgressFill: $("#collection-progress-fill"), collectionPercent: $("#collection-percent"),
  guideOverlay: $("#guide-overlay"), guideModal: $("#guide-modal"), guideClose: $("#guide-close"), guideContent: $("#guide-content"),
  backupFile: $("#backup-file"), toast: $("#toast")
};
const desktopQuery = window.matchMedia("(min-width: 768px)");
let lastFocusedElement = null;
let guideLastFocusedElement = null;
let currentGoodsId = null;
let visibleGoodsIds = [];
let modalTimer;
let guideTimer;
let toastTimer;
let guideRequest = 0;

function sortByCustomOrder(values, order) {
  const rank = new Map(order.map((value, index) => [value, index]));
  return [...values].sort((a, b) => {
    const aIndex = rank.get(a) ?? order.length;
    const bIndex = rank.get(b) ?? order.length;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b, "zh-CN", { numeric: true });
  });
}

async function fetchJson(url) {
  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${separator}_=${Date.now()}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function dataList(data, key) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  throw new Error(`${key} 数据格式不正确`);
}

async function loadData() {
  els.loading.hidden = false;
  els.error.hidden = true;
  els.empty.hidden = true;
  els.grid.hidden = true;
  try {
    const [goodsData, seriesData] = await Promise.all([fetchJson("./data/goods.json"), fetchJson("./data/series.json")]);
    const goods = dataList(goodsData, "goods");
    const series = dataList(seriesData, "series");
    state.series = series.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const seriesMap = new Map(state.series.map(item => [item.slug, item.name]));
    state.goods = goods.map((item, index) => ({ ...item, id: item.id || `goods-${index}`, seriesName: seriesMap.get(item.series) || item.series }));
    state.loaded = true;
    els.orderToggle.disabled = false;
    initialiseFilters();
    renderSeriesRail();
    updatePersonalUI();
    if (!isStorageAvailable()) showToast("浏览器未允许本地保存，请及时导出备份");
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
  select.length = 1;
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
  els.materialChips.innerHTML = materials.map(material => `<button class="material-chip" type="button" data-material="${escapeHtml(material)}" aria-pressed="${state.filters.materials.includes(material)}">${escapeHtml(material)}</button>`).join("");
  els.sizeField.hidden = !state.goods.some(item => String(item.size || "").trim());
  syncFilterControls();
  updateMoreFiltersVisibility();
  requestAnimationFrame(updateMaterialMoreVisibility);
}

function renderSeriesRail() {
  const seriesCount = state.goods.reduce((map, item) => {
    const key = item.series || "";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const renderItem = ({ slug, name, cover, note, index, count }) => {
    const pressed = state.filters.seriesId === slug;
    const coverHtml = cover
      ? renderImage({ src: cover, alt: "", className: "rail__cover", width: 208, height: 208 })
      : `<span class="rail__cover rail__cover--all"><svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="16" cy="9" rx="4" ry="8"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(72 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(144 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(216 16 16)"/><ellipse cx="16" cy="9" rx="4" ry="8" transform="rotate(288 16 16)"/></g></svg></span>`;
    return `<button class="rail__item" type="button" data-series="${escapeHtml(slug)}" aria-pressed="${pressed}" title="${escapeHtml(note || name)}">
    <span class="rail__tag" aria-hidden="true">当前</span>
    ${coverHtml}<span class="rail__title"><span class="rail__name">${escapeHtml(name)}</span><span class="rail__index" aria-hidden="true">${String(index).padStart(2, "0")}</span></span><span class="rail__count">已收录 ${count} 件</span></button>`;
  };
  const allButton = renderItem({ slug: "", name: "全部", cover: null, index: 1, count: state.goods.length });
  const items = state.series.map((series, index) => renderItem({
    slug: series.slug, name: series.name, cover: series.cover, note: series.note,
    index: index + 2, count: seriesCount.get(series.slug) || 0
  })).join("");
  els.rail.innerHTML = `<div class="rail__track">${allButton}${items}</div>`;
  bindImageFallbacks(els.rail);
}

function baseGoodsForRoute() {
  const kind = ROUTES[state.route].kind;
  return kind ? state.goods.filter(item => hasItem(kind, item.id)) : state.goods;
}

function applyFilters() {
  if (!state.loaded) return;
  const baseGoods = baseGoodsForRoute();
  const filtered = filterGoods(baseGoods, state.filters);
  const orderedGoods = state.reverse ? [...filtered].reverse() : filtered;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.grid.hidden = filtered.length === 0;
  els.empty.hidden = filtered.length !== 0;
  els.grid.innerHTML = orderedGoods.map(renderCard).join("");
  bindImageFallbacks(els.grid);
  visibleGoodsIds = orderedGoods.map(item => String(item.id));
  updateModalNav();

  const seriesSelected = state.series.find(item => item.slug === state.filters.seriesId);
  els.catalogTitle.textContent = seriesSelected ? seriesSelected.name : (state.route === "catalog" ? "图鉴目录" : ROUTES[state.route].listTitle);
  els.subtitle.textContent = ROUTES[state.route].subtitle || "ALL GOODS";
  els.subtitle.hidden = state.route === "catalog" && activeFilterCount() > 0;
  els.result.textContent = `找到 ${filtered.length} 件谷子${state.reverse ? " · 已逆序" : ""}`;

  const route = ROUTES[state.route];
  const personalEmpty = route.kind && baseGoods.length === 0;
  els.emptyTitle.textContent = personalEmpty ? route.emptyTitle : "没有找到符合条件的谷子";
  els.emptyDescription.textContent = personalEmpty ? route.emptyText : "试着减少一个筛选条件，或换个关键词吧。";
  els.emptyReset.textContent = personalEmpty ? "去图鉴看看" : "查看全部谷子";
  updateFilterIndicators();
  requestAnimationFrame(updateScrollButtons);
}

function activeFilterCount() {
  const f = state.filters;
  return [f.seriesId, f.type, f.event, f.year, f.release_type, f.hasSize].filter(Boolean).length + f.platforms.length + f.materials.length;
}

function updateFilterIndicators() {
  const count = activeFilterCount();
  const expanded = els.toggle.getAttribute("aria-expanded") === "true";
  els.toggleLabel.textContent = expanded ? `收起筛选${count ? `（${count}）` : ""}` : "筛选";
  els.filterCount.hidden = expanded || count === 0;
  els.filterCount.textContent = String(count);
  els.reset.hidden = count === 0;
  els.resetDivider.hidden = count === 0;
}

function setFilters(patch) {
  state.filters = { ...state.filters, ...patch };
  state.filtersByRoute[state.route] = state.filters;
}

function syncFilterControls() {
  els.search.value = state.filters.search;
  els.size.checked = state.filters.hasSize;
  document.querySelectorAll("[data-filter]").forEach(select => {
    const key = select.dataset.filter;
    select.value = key === "platforms" ? (state.filters.platforms[0] || "") : state.filters[key];
  });
  els.materialChips.querySelectorAll("[data-material]").forEach(chip => {
    chip.setAttribute("aria-pressed", String(state.filters.materials.includes(chip.dataset.material)));
  });
}

function resetFilters() {
  const search = state.filters.search;
  state.filters = { ...emptyFilters(), search };
  state.filtersByRoute[state.route] = state.filters;
  syncFilterControls();
  renderSeriesRail();
  applyFilters();
}

function validPersonalCount(kind) {
  const goodsIds = new Set(state.goods.map(item => String(item.id)));
  return getIds(kind).filter(id => goodsIds.has(String(id))).length;
}

function updateStats() {
  const total = state.goods.length;
  const owned = validPersonalCount("owned");
  const wishlist = validPersonalCount("wishlist");
  $("#total-count").textContent = state.loaded ? String(total) : "—";
  $("#owned-count").textContent = String(owned);
  $("#wishlist-count").textContent = String(wishlist);
  $("#owned-total").textContent = state.loaded ? String(total) : "—";
  $("#wishlist-total").textContent = state.loaded ? String(total) : "—";

  const kind = ROUTES[state.route].kind;
  if (!kind) return;
  const count = kind === "owned" ? owned : wishlist;
  const percent = total ? Math.round(count / total * 100) : 0;
  els.collectionCount.textContent = String(count);
  els.collectionTotal.textContent = state.loaded ? String(total) : "—";
  els.collectionPercent.textContent = `${percent}%`;
  els.collectionProgressFill.style.width = `${percent}%`;
  els.collectionProgress.setAttribute("aria-valuenow", String(percent));
  els.collectionProgress.setAttribute("aria-valuetext", `${count}／${total} 件，${percent}%`);
}

function updateModalActions() {
  if (!currentGoodsId || els.overlay.hidden) return;
  els.modalContent.querySelectorAll("[data-personal-action]").forEach(button => {
    const kind = button.dataset.personalAction;
    const active = hasItem(kind, currentGoodsId);
    const owned = kind === "owned";
    button.setAttribute("aria-pressed", String(active));
    button.querySelector("span").textContent = active ? (owned ? "已入库" : "已加入心愿") : (owned ? "入库" : "心愿");
    button.querySelector("small").textContent = active ? "再次点击可移除" : (owned ? "加入个人仓库" : "加入个人心愿单");
  });
}

function updatePersonalUI() {
  updateStats();
  applyFilters();
  updateModalActions();
}

function updateRoute({ initial = false } = {}) {
  state.route = routeFromHash();
  state.filters = state.filtersByRoute[state.route];
  const route = ROUTES[state.route];
  document.body.dataset.route = state.route;
  document.title = route.title;
  document.querySelectorAll("[data-route-link]").forEach(link => {
    if (link.dataset.routeLink === state.route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  els.catalogHero.hidden = state.route !== "catalog";
  els.collectionHero.hidden = state.route === "catalog";
  els.collectionTitle.textContent = route.heading || "斐恩官周图鉴";
  syncFilterControls();
  if (state.loaded) {
    renderSeriesRail();
    updatePersonalUI();
  } else {
    updateStats();
  }
  if (!initial) window.scrollTo({ top: 0, behavior: "auto" });
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

function openModal(id) {
  const item = state.goods.find(goods => String(goods.id) === String(id));
  if (!item) return;
  clearTimeout(modalTimer);
  currentGoodsId = String(id);
  lastFocusedElement = document.activeElement;
  els.modalContent.innerHTML = renderModal(item, { owned: hasItem("owned", id), wishlist: hasItem("wishlist", id) });
  bindImageFallbacks(els.modalContent);
  updateModalNav();
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
  clearTimeout(modalTimer);
  els.overlay.classList.remove("is-open");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
  modalTimer = window.setTimeout(() => {
    els.overlay.hidden = true;
    els.modalContent.innerHTML = "";
    currentGoodsId = null;
    updateModalNav();
    if (els.guideOverlay.hidden) document.body.classList.remove("is-modal-open");
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
    else document.querySelector(`[data-route-link="${state.route}"]`)?.focus();
  }, delay);
}

function modalNavButtons() {
  return [...els.overlay.querySelectorAll(":scope > [data-modal-nav]"), ...els.modalContent.querySelectorAll("[data-modal-nav]")];
}

function updateModalNav() {
  const show = Boolean(currentGoodsId) && visibleGoodsIds.length > 1;
  modalNavButtons().forEach(button => { button.hidden = !show; });
}

function stepModal(direction) {
  if (!currentGoodsId || visibleGoodsIds.length < 2) return;
  const index = visibleGoodsIds.indexOf(currentGoodsId);
  if (index === -1) return;
  const length = visibleGoodsIds.length;
  const nextIndex = (index + (direction === "next" ? 1 : -1) + length) % length;
  const nextId = visibleGoodsIds[nextIndex];
  const item = state.goods.find(goods => String(goods.id) === nextId);
  if (!item) return;
  currentGoodsId = nextId;
  els.modalContent.innerHTML = renderModal(item, { owned: hasItem("owned", nextId), wishlist: hasItem("wishlist", nextId) });
  bindImageFallbacks(els.modalContent);
  els.modal.scrollTop = 0;
  updateModalNav();
  els.modalContent.classList.remove("is-step-next", "is-step-prev");
  void els.modalContent.offsetWidth;
  els.modalContent.classList.add(direction === "next" ? "is-step-next" : "is-step-prev");
}

function renderGuide(text) {
  const paragraphs = String(text || "").trim().split(/\n\s*\n/).filter(Boolean);
  if (!paragraphs.length) return;
  els.guideContent.innerHTML = paragraphs.map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

async function loadGuideText() {
  const request = ++guideRequest;
  try {
    const site = await fetchJson("./data/site.json");
    if (request === guideRequest && typeof site.guide === "string") renderGuide(site.guide);
  } catch (error) {
    console.warn("使用说明远程内容加载失败，保留默认说明", error);
  }
}

function openGuide() {
  clearTimeout(guideTimer);
  guideLastFocusedElement = document.activeElement;
  els.guideOverlay.hidden = false;
  document.body.classList.add("is-modal-open");
  els.guideModal.scrollTop = 0;
  loadGuideText();
  requestAnimationFrame(() => {
    els.guideOverlay.classList.add("is-open");
    els.guideClose.focus();
  });
}

function closeGuide() {
  if (els.guideOverlay.hidden) return;
  clearTimeout(guideTimer);
  guideRequest += 1;
  els.guideOverlay.classList.remove("is-open");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
  guideTimer = window.setTimeout(() => {
    els.guideOverlay.hidden = true;
    if (els.overlay.hidden) document.body.classList.remove("is-modal-open");
    if (guideLastFocusedElement?.isConnected) guideLastFocusedElement.focus();
  }, delay);
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = window.setTimeout(() => { els.toast.hidden = true; }, 3000);
}

function exportPersonalData() {
  const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `斐恩图鉴备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("备份已导出，请妥善保存文件");
}

els.rail.addEventListener("click", event => {
  const button = event.target.closest("[data-series]");
  if (!button) return;
  setFilters({ seriesId: button.dataset.series });
  els.rail.querySelectorAll("[data-series]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  applyFilters();
});
els.search.addEventListener("input", () => { setFilters({ search: els.search.value }); applyFilters(); });
document.querySelectorAll("[data-filter]").forEach(select => {
  select.addEventListener("change", () => {
    const key = select.dataset.filter;
    setFilters({ [key]: key === "platforms" ? (select.value ? [select.value] : []) : select.value });
    applyFilters();
  });
});
els.size.addEventListener("change", () => { setFilters({ hasSize: els.size.checked }); applyFilters(); });
els.materialChips.addEventListener("click", event => {
  const chip = event.target.closest("[data-material]");
  if (!chip) return;
  const value = chip.dataset.material;
  const selected = state.filters.materials.includes(value);
  setFilters({ materials: selected ? state.filters.materials.filter(item => item !== value) : [...state.filters.materials, value] });
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
  updateFilterIndicators();
  updateMoreFiltersVisibility();
});
els.moreFilters.addEventListener("click", () => {
  const expanded = !els.panel.classList.contains("show-all");
  els.panel.classList.toggle("show-all", expanded);
  els.moreFilters.setAttribute("aria-expanded", String(expanded));
  els.moreFilters.firstChild.textContent = expanded ? "收起更多选项" : "更多筛选选项在此展开";
  requestAnimationFrame(updateMaterialMoreVisibility);
});
els.reset.addEventListener("click", resetFilters);
els.emptyReset.addEventListener("click", () => {
  if (ROUTES[state.route].kind && baseGoodsForRoute().length === 0) location.hash = "#/catalog";
  else resetFilters();
});
$("#retry-load").addEventListener("click", loadData);
els.grid.addEventListener("click", event => {
  const card = event.target.closest("[data-goods-id]");
  if (card) openModal(card.dataset.goodsId);
});
els.modalClose.addEventListener("click", closeModal);
els.overlay.addEventListener("click", event => {
  const nav = event.target.closest("[data-modal-nav]");
  if (nav) { stepModal(nav.dataset.modalNav); return; }
  if (event.target === els.overlay) closeModal();
});

let touchStartX = 0;
let touchStartY = 0;
els.modal.addEventListener("touchstart", event => {
  if (event.touches.length !== 1) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });
els.modal.addEventListener("touchend", event => {
  if (!currentGoodsId || visibleGoodsIds.length < 2) return;
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  stepModal(dx < 0 ? "next" : "prev");
}, { passive: true });
els.modalContent.addEventListener("click", event => {
  const button = event.target.closest("[data-personal-action]");
  if (!button || !currentGoodsId) return;
  const kind = button.dataset.personalAction;
  const { added, persisted } = toggleItem(kind, currentGoodsId);
  const actionName = kind === "owned" ? (added ? "已加入仓库" : "已移出仓库") : (added ? "已加入心愿单" : "已移出心愿单");
  showToast(persisted ? actionName : `${actionName}，但仅在本次页面中有效`);
});

$("#open-guide").addEventListener("click", openGuide);
els.guideClose.addEventListener("click", closeGuide);
els.guideOverlay.addEventListener("click", event => { if (event.target === els.guideOverlay) closeGuide(); });
document.addEventListener("keydown", event => {
  if (!els.guideOverlay.hidden) {
    if (event.key === "Escape") { event.preventDefault(); closeGuide(); }
    if (event.key === "Tab") trapFocus(event, els.guideModal);
    return;
  }
  if (els.overlay.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeModal(); }
  if (event.key === "ArrowLeft") { event.preventDefault(); stepModal("prev"); }
  if (event.key === "ArrowRight") { event.preventDefault(); stepModal("next"); }
  if (event.key === "Tab") trapFocus(event, els.modal);
});

document.querySelectorAll('[data-backup-action="export"]').forEach(button => button.addEventListener("click", exportPersonalData));
document.querySelectorAll('[data-backup-action="import"]').forEach(button => button.addEventListener("click", () => {
  els.backupFile.value = "";
  els.backupFile.click();
}));
els.backupFile.addEventListener("change", async () => {
  const file = els.backupFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("备份文件过大，请选择本网站导出的 JSON 文件");
    const counts = importBackup(await file.text());
    showToast(`备份已合并：仓库 ${counts.owned} 条，心愿 ${counts.wishlist} 条`);
  } catch (error) {
    showToast(error.message || "备份导入失败，请检查文件");
  } finally {
    els.backupFile.value = "";
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
window.addEventListener("resize", () => requestAnimationFrame(() => { updateMoreFiltersVisibility(); updateMaterialMoreVisibility(); updateScrollButtons(); }));
window.addEventListener("hashchange", () => updateRoute());
desktopQuery.addEventListener("change", updateMoreFiltersVisibility);
subscribe(updatePersonalUI);

// 柄图系列：电脑端鼠标拖拽滚动。
let isDraggingRail = false;
let railStartX = 0;
let railScrollLeft = 0;
els.rail.addEventListener("mousedown", event => {
  isDraggingRail = true;
  railStartX = event.pageX - els.rail.offsetLeft;
  railScrollLeft = els.rail.scrollLeft;
});
els.rail.addEventListener("mouseleave", () => { isDraggingRail = false; });
els.rail.addEventListener("mouseup", () => { isDraggingRail = false; });
els.rail.addEventListener("mousemove", event => {
  if (!isDraggingRail) return;
  event.preventDefault();
  els.rail.scrollLeft = railScrollLeft - (event.pageX - els.rail.offsetLeft - railStartX) * 1.5;
});

$("#current-year").textContent = String(new Date().getFullYear());
if (location.hash !== `#/${initialRoute}`) history.replaceState(null, "", `#/${initialRoute}`);
updateRoute({ initial: true });
updateScrollButtons();
loadData();
