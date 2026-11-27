const NICKNAME_KEY = "fuen-catalog:visitor-id:v1";
const input = document.querySelector("#nickname-input");
const listeners = new Set();
let nickname = readNickname();

function limitCharacters(value) {
  return Array.from(String(value || "")).slice(0, 16).join("").trim();
}

function readNickname() {
  try {
    return limitCharacters(localStorage.getItem(NICKNAME_KEY) || "");
  } catch (error) {
    console.warn("Nickname 暂时无法读取", error);
    return "";
  }
}

function syncNicknameUI() {
  const route = document.body.dataset.route;
  const collectionTitle = document.querySelector("#collection-title-text");
  if (collectionTitle) {
    if (route === "warehouse") collectionTitle.textContent = nickname ? `${nickname}的仓库` : "仓库";
    if (route === "wishlist") collectionTitle.textContent = nickname ? `${nickname}的心愿单` : "心愿单";
  }
  const recordTitle = nickname ? `${nickname}的收藏记录` : "我的收藏记录";
  const catalogRecordTitle = document.querySelector("#collection-record-title");
  const specialRecordTitle = document.querySelector("#special-record-title");
  if (catalogRecordTitle) catalogRecordTitle.textContent = recordTitle;
  if (specialRecordTitle) specialRecordTitle.textContent = recordTitle;
  const exportNicknameInput = document.querySelector("#visitor-id");
  if (exportNicknameInput) exportNicknameInput.value = nickname;
  if (input && document.activeElement !== input && input.value !== nickname) input.value = nickname;
}

function notify() {
  syncNicknameUI();
  listeners.forEach(listener => listener(nickname));
}

export function getNickname() {
  return nickname;
}

export function setNickname(value) {
  nickname = limitCharacters(value);
  let persisted = true;
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch (error) {
    persisted = false;
    console.warn("Nickname 暂时无法保存", error);
  }
  notify();
  return { persisted };
}

export function importNickname(value) {
  if (nickname || typeof value !== "string" || !limitCharacters(value)) return false;
  setNickname(value);
  return true;
}

export function clearNickname() {
  return setNickname("");
}

export function subscribeNickname(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

input?.addEventListener("input", () => {
  const limited = Array.from(input.value).slice(0, 16).join("");
  if (input.value !== limited) input.value = limited;
  setNickname(input.value);
});
window.addEventListener("storage", event => {
  if (event.key !== NICKNAME_KEY) return;
  nickname = readNickname();
  notify();
});
new MutationObserver(syncNicknameUI).observe(document.body, {
  attributes: true,
  attributeFilter: ["data-route"]
});
syncNicknameUI();
