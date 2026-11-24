const NICKNAME_KEY = "fuen-catalog:visitor-id:v1";

const openButton = document.querySelector("#nickname-open");
const overlay = document.querySelector("#nickname-overlay");
const input = document.querySelector("#nickname-input");
const collectionTitle = document.querySelector("#collection-title");
const recordTitle = document.querySelector("#collection-record-title");
const exportNicknameInput = document.querySelector("#visitor-id");

let nickname = readNickname();

function limitCharacters(value) {
  return Array.from(value).slice(0, 16).join("");
}

function readNickname() {
  try {
    return limitCharacters(localStorage.getItem(NICKNAME_KEY) || "").trim();
  } catch (error) {
    console.warn("Nickname 暂时无法读取", error);
    return "";
  }
}

function syncNicknameUI() {
  const route = document.body.dataset.route;

  if (route === "warehouse") {
    collectionTitle.textContent = nickname ? `${nickname}的仓库` : "已入库";
  } else if (route === "wishlist") {
    collectionTitle.textContent = nickname ? `${nickname}的心愿单` : "加入心愿单";
  }

  recordTitle.textContent = nickname
    ? `${nickname}的收藏记录`
    : "我的收藏记录";

  // 截图模块继续读取这个隐藏字段，因此导出标题无需另行修改。
  exportNicknameInput.value = nickname;
}

function openNicknameDialog() {
  input.value = nickname;
  overlay.hidden = false;
  document.body.classList.add("is-modal-open");

  requestAnimationFrame(() => input.focus());
}

function saveAndClose() {
  if (overlay.hidden) return;

  nickname = limitCharacters(input.value).trim();
  input.value = nickname;

  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch (error) {
    console.warn("Nickname 暂时无法保存", error);
  }

  syncNicknameUI();
  overlay.hidden = true;
  document.body.classList.remove("is-modal-open");

  if (openButton.getClientRects().length) {
    openButton.focus();
  }
}

openButton.addEventListener("click", openNicknameDialog);

input.addEventListener("input", () => {
  const limited = limitCharacters(input.value);
  if (input.value !== limited) input.value = limited;
});

// 点击输入框外的遮罩空白处，自动保存并关闭。
overlay.addEventListener("click", event => {
  if (event.target === overlay) saveAndClose();
});

document.addEventListener("keydown", event => {
  if (overlay.hidden) return;

  if (event.key === "Escape" || event.key === "Enter") {
    event.preventDefault();
    saveAndClose();
  } else if (event.key === "Tab") {
    event.preventDefault();
    input.focus();
  }
});

window.addEventListener("hashchange", syncNicknameUI);

// 支持其他同源标签页修改后同步。
window.addEventListener("storage", event => {
  if (event.key !== NICKNAME_KEY) return;
  nickname = readNickname();
  syncNicknameUI();
});

// 路由模块更新大标题后，再按当前 Nickname 同步一次。
new MutationObserver(syncNicknameUI).observe(document.body, {
  attributes: true,
  attributeFilter: ["data-route"]
});

syncNicknameUI();
