const STORAGE_KEY = "fuen-catalog:prices:v1";
const VERSION = 1;
const KINDS = ["owned", "wishlist"];

const emptyData = () => ({ version: VERSION, owned: {}, wishlist: {} });
const now = () => new Date().toISOString();

function assertKind(kind) {
  if (!KINDS.includes(kind)) throw new Error("未知的个人列表类型");
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function normalizeQty(value) {
  const qty = Number(value ?? 1);
  return Number.isSafeInteger(qty) && qty > 0 ? qty : 1;
}

function normalizeEntry(value) {
  // 兼容早期直接以数字保存金额的记录。
  if (typeof value === "number" || typeof value === "string") {
    return { price: normalizePrice(value), qty: 1, updatedAt: "" };
  }
  if (!value || typeof value !== "object") return null;
  return {
    price: normalizePrice(value.price),
    qty: normalizeQty(value.qty),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : ""
  };
}

function normalizeRecord(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  Object.entries(value).forEach(([rawId, rawEntry]) => {
    const id = String(rawId || "").trim();
    if (!id || id.length > 128) return;
    const entry = normalizeEntry(rawEntry);
    if (entry) result[id] = entry;
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
  console.warn("本地金额记录暂时无法读取", error);
}

const listeners = new Set();
function notify(detail = { kind: "", id: "" }) {
  listeners.forEach(listener => listener(detail));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    storageAvailable = true;
    return true;
  } catch (error) {
    storageAvailable = false;
    console.warn("本地金额记录暂时无法保存", error);
    return false;
  }
}

export function getPriceRecord(kind, id) {
  assertKind(kind);
  const record = data[kind][String(id)];
  return record ? { ...record } : null;
}

export function savePriceRecord(kind, id, record) {
  assertKind(kind);
  const key = String(id || "").trim();
  if (!key) throw new Error("制品 ID 不能为空");
  const price = normalizePrice(record?.price);
  if (record?.price !== null && record?.price !== "" && record?.price !== undefined && price === null) {
    throw new Error("金额需为大于或等于 0 的数字");
  }
  const qty = Number(record?.qty ?? 1);
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("数量需为大于或等于 1 的整数");

  const current = data[kind][key];
  // 空白默认记录不占用存储，也不在页面加载时产生写入。
  if (!current && price === null && qty === 1) return { changed: false, persisted: true };
  if (current && current.price === price && current.qty === qty) return { changed: false, persisted: true };

  const nextRecord = { ...data[kind], [key]: { price, qty, updatedAt: now() } };
  data = { ...data, [kind]: nextRecord };
  const persisted = persist();
  notify({ kind, id: key });
  return { changed: true, persisted };
}

export function removePriceRecord(kind, id) {
  assertKind(kind);
  const key = String(id || "").trim();
  if (!key || !Object.hasOwn(data[kind], key)) return { changed: false, persisted: true };
  const nextRecord = { ...data[kind] };
  delete nextRecord[key];
  data = { ...data, [kind]: nextRecord };
  const persisted = persist();
  notify({ kind, id: key });
  return { changed: true, persisted };
}

export function subscribePrices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createPriceBackup() {
  return {
    version: VERSION,
    owned: structuredClone(data.owned),
    wishlist: structuredClone(data.wishlist)
  };
}

export function validatePriceBackup(parsed) {
  const source = parsed?.prices;
  if (!source) return;
  if (typeof source !== "object" || Array.isArray(source)) throw new Error("备份中的金额记录格式不正确");
  if (Number(source.version || 1) > VERSION) throw new Error("金额备份版本较新，请先更新网站");
}

function mergeRecords(current, incoming) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([id, entry]) => {
    const existing = merged[id];
    if (!existing) {
      merged[id] = entry;
      return;
    }
    const currentTime = Date.parse(existing.updatedAt);
    const incomingTime = Date.parse(entry.updatedAt);
    // 旧备份没有时间戳时只补空缺；有时间戳的新记录才允许替换。
    if (Number.isFinite(incomingTime) && (!Number.isFinite(currentTime) || incomingTime > currentTime)) {
      merged[id] = entry;
    }
  });
  return merged;
}

export function clearPriceData() {
  data = emptyData();
  const persisted = persist();
  notify();
  return { persisted };
}

export function importPriceBackup(parsed) {
  validatePriceBackup(parsed);
  if (!parsed?.prices) return { owned: 0, wishlist: 0, imported: false };
  const incoming = normalize(parsed.prices);
  const nextData = {
    version: VERSION,
    owned: mergeRecords(data.owned, incoming.owned),
    wishlist: mergeRecords(data.wishlist, incoming.wishlist)
  };
  const changed = JSON.stringify(nextData) !== JSON.stringify(data);
  data = nextData;
  if (changed && !persist()) throw new Error("浏览器未允许本地保存，请检查隐私或存储设置");
  if (changed) notify();
  return {
    owned: Object.keys(data.owned).length,
    wishlist: Object.keys(data.wishlist).length,
    imported: true
  };
}

window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  try {
    data = event.newValue ? normalize(JSON.parse(event.newValue)) : emptyData();
    storageAvailable = true;
    notify();
  } catch (error) {
    console.warn("忽略了另一标签页中的无效金额数据", error);
  }
});
