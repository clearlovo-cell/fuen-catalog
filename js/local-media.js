const DB_NAME = "fuen-catalog-media";
const DB_VERSION = 1;
const STORE_NAME = "media";
const CHANNEL_NAME = "fuen-catalog:media-changes";

export const MEDIA_IDS = {
  profilePhoto: "profile-photo",
  backgroundMusic: "background-music",
  menuVoices: Array.from({ length: 6 }, (_, index) => `menu-voice-${index + 1}`)
};

let databasePromise;
const listeners = new Set();
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL_NAME) : null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地媒体存储"));
    request.onblocked = () => reject(new Error("本地媒体存储被其他页面占用，请关闭旧版页面后重试"));
  });
  return databasePromise;
}

async function runRequest(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地媒体操作失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地媒体操作已中止"));
  });
}

function publish(detail) {
  listeners.forEach(listener => listener(detail));
  channel?.postMessage(detail);
}

export async function getMediaRecord(id) {
  const record = await runRequest("readonly", store => store.get(id));
  return record || null;
}

export async function getAllMediaRecords() {
  const records = await runRequest("readonly", store => store.getAll());
  return Array.isArray(records) ? records : [];
}

export async function saveMediaRecord(id, blob, name = "") {
  if (!(blob instanceof Blob)) throw new Error("媒体文件格式不正确");
  const record = {
    id,
    blob,
    name: String(name || ""),
    type: blob.type || "application/octet-stream",
    updatedAt: new Date().toISOString()
  };
  await runRequest("readwrite", store => store.put(record));
  publish({ id });
  return record;
}

export async function removeMediaRecord(id) {
  await runRequest("readwrite", store => store.delete(id));
  publish({ id });
}

export async function clearMediaRecords() {
  await runRequest("readwrite", store => store.clear());
  publish({ id: "*" });
}

export function subscribeMedia(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

channel?.addEventListener("message", event => {
  listeners.forEach(listener => listener(event.data || {}));
});
