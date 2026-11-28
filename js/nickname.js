const NICKNAME_KEY = "fuen-catalog:visitor-id:v1";
const SLOGAN_KEY = "fuen-catalog:slogan:v1";
const CONNECTOR_KEY = "fuen-catalog:title-connector:v1";
const DEFAULT_SLOGAN = "お前の顔を、絵にして残したい、そう思ったよ。";
const CONNECTORS = { de: "的", no: "の", dot: " · ", none: "" };
const input = document.querySelector("#nickname-input");
const sloganInput = document.querySelector("#slogan-input");
const connectorButtons = document.querySelectorAll("[data-title-connector]");
const listeners = new Set();

function limitCharacters(value, limit) {
  return Array.from(String(value || "")).slice(0, limit).join("").trim();
}

function readStored(key, limit) {
  try {
    return limitCharacters(localStorage.getItem(key), limit);
  } catch (error) {
    console.warn("本地个性化设置暂时无法读取", error);
    return "";
  }
}

let nickname = readStored(NICKNAME_KEY, 16);
let slogan = readStored(SLOGAN_KEY, 80);
let connector = readStored(CONNECTOR_KEY, 8);
if (!Object.hasOwn(CONNECTORS, connector)) connector = "de";

export function getPersonalizedTitle(label, emptyLabel = label) {
  return nickname ? `${nickname}${CONNECTORS[connector]}${label}` : emptyLabel;
}

function syncProfileUI() {
  const route = document.body.dataset.route;
  const collectionTitle = document.querySelector("#collection-title-text");
  if (collectionTitle) {
    if (route === "warehouse") collectionTitle.textContent = getPersonalizedTitle("仓库");
    if (route === "wishlist") collectionTitle.textContent = getPersonalizedTitle("心愿单");
  }

  const recordTitle = getPersonalizedTitle("收藏记录", "我的收藏记录");
  const catalogRecordTitle = document.querySelector("#collection-record-title");
  const specialRecordTitle = document.querySelector("#special-record-title");
  if (catalogRecordTitle) catalogRecordTitle.textContent = recordTitle;
  if (specialRecordTitle) specialRecordTitle.textContent = recordTitle;

  const exportNicknameInput = document.querySelector("#visitor-id");
  if (exportNicknameInput) exportNicknameInput.value = nickname;
  const intro = document.querySelector(".hero__intro");
  if (intro) intro.textContent = slogan || DEFAULT_SLOGAN;
  if (input && document.activeElement !== input && input.value !== nickname) input.value = nickname;
  if (sloganInput && document.activeElement !== sloganInput && sloganInput.value !== slogan) sloganInput.value = slogan;
  connectorButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.titleConnector === connector));
  });
}

function notify() {
  syncProfileUI();
  listeners.forEach(listener => listener(nickname));
}

function persistValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("本地个性化设置暂时无法保存", error);
    return false;
  }
}

export function getNickname() {
  return nickname;
}

export function getSlogan() {
  return slogan;
}

export function getTitleConnector() {
  return connector;
}

export function setNickname(value) {
  nickname = limitCharacters(value, 16);
  const persisted = persistValue(NICKNAME_KEY, nickname);
  notify();
  return { persisted };
}

export function setSlogan(value) {
  slogan = limitCharacters(value, 80);
  const persisted = persistValue(SLOGAN_KEY, slogan);
  notify();
  return { persisted };
}

export function setTitleConnector(value) {
  if (!Object.hasOwn(CONNECTORS, value)) return { persisted: false };
  connector = value;
  const persisted = persistValue(CONNECTOR_KEY, connector);
  notify();
  return { persisted };
}

export function importNickname(value) {
  if (nickname || typeof value !== "string" || !limitCharacters(value, 16)) return false;
  setNickname(value);
  return true;
}

export function importSlogan(value) {
  if (slogan || typeof value !== "string" || !limitCharacters(value, 80)) return false;
  setSlogan(value);
  return true;
}

export function importTitleConnector(value) {
  if (typeof value !== "string" || !Object.hasOwn(CONNECTORS, value)) return false;
  setTitleConnector(value);
  return true;
}

export function clearProfile() {
  const results = [setNickname(""), setSlogan(""), setTitleConnector("de")];
  return { persisted: results.every(result => result.persisted) };
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

sloganInput?.addEventListener("input", () => {
  const limited = Array.from(sloganInput.value).slice(0, 80).join("");
  if (sloganInput.value !== limited) sloganInput.value = limited;
  setSlogan(sloganInput.value);
});

connectorButtons.forEach(button => {
  button.addEventListener("click", () => setTitleConnector(button.dataset.titleConnector));
});

window.addEventListener("storage", event => {
  if (event.key === NICKNAME_KEY) nickname = readStored(NICKNAME_KEY, 16);
  else if (event.key === SLOGAN_KEY) slogan = readStored(SLOGAN_KEY, 80);
  else if (event.key === CONNECTOR_KEY) {
    connector = readStored(CONNECTOR_KEY, 8);
    if (!Object.hasOwn(CONNECTORS, connector)) connector = "de";
  } else return;
  notify();
});

new MutationObserver(syncProfileUI).observe(document.body, {
  attributes: true,
  attributeFilter: ["data-route"]
});
syncProfileUI();
