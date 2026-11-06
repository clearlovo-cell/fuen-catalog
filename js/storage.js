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
