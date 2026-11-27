import { createBackup, importBackup } from "./backup.js";
import { clearPersonalData } from "./storage.js";
import { clearPriceData } from "./prices.js";
import { clearNickname } from "./nickname.js";
import { getCollectionStats } from "./stats.js";
import { formatAmount } from "./render.js";

const $ = selector => document.querySelector(selector);
const overlay = $("#clear-data-overlay");
const dialog = $("#clear-data-dialog");
const openClearButton = $("#clear-data-open");
const cancelClearButton = $("#clear-data-cancel");
const confirmClearButton = $("#clear-data-confirm");
const backupFile = $("#backup-file");
let showToast = () => {};
let clearLastFocusedElement = null;

export function initialiseSpecial({ toast }) {
  showToast = toast;
  document.querySelectorAll('[data-backup-action="export"]').forEach(button => button.addEventListener("click", exportPersonalData));
  document.querySelectorAll('[data-backup-action="import"]').forEach(button => button.addEventListener("click", () => {
    backupFile.value = "";
    backupFile.click();
  }));
  backupFile.addEventListener("change", importPersonalData);
  openClearButton.addEventListener("click", openClearDialog);
  cancelClearButton.addEventListener("click", closeClearDialog);
  confirmClearButton.addEventListener("click", clearAllPersonalData);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeClearDialog();
  });
  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeClearDialog();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const target = document.activeElement === cancelClearButton ? confirmClearButton : cancelClearButton;
      target.focus();
    }
  });
}

export function updateSpecial(goods) {
  const stats = getCollectionStats(goods);
  $("#special-total-count").textContent = String(stats.total);
  $("#special-owned-count").textContent = String(stats.owned);
  $("#special-wishlist-count").textContent = String(stats.wishlist);
  $("#special-owned-total").textContent = String(stats.total);
  $("#special-wishlist-total").textContent = String(stats.total);
  $("#special-owned-amount").textContent = formatAmount(stats.ownedAmount);
  $("#special-wishlist-amount").textContent = formatAmount(stats.wishlistAmount);
  $("#special-collection-percent").textContent = `${stats.ownedPercent}%`;
  $("#special-progress-fill").style.width = `${stats.ownedPercent}%`;
  $("#special-progress").setAttribute("aria-valuenow", String(stats.ownedPercent));
  $("#special-progress").setAttribute("aria-valuetext", `${stats.owned}／${stats.total} 件，${stats.ownedPercent}%`);
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

async function importPersonalData() {
  const file = backupFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("备份文件过大，请选择本网站导出的 JSON 文件");
    const counts = importBackup(await file.text());
    showToast(`备份已合并：仓库 ${counts.owned} 条，心愿 ${counts.wishlist} 条`);
  } catch (error) {
    showToast(error.message || "备份导入失败，请检查文件");
  } finally {
    backupFile.value = "";
  }
}

function openClearDialog() {
  clearLastFocusedElement = document.activeElement;
  overlay.hidden = false;
  document.body.classList.add("is-modal-open");
  requestAnimationFrame(() => cancelClearButton.focus());
}

function closeClearDialog() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("is-modal-open");
  if (clearLastFocusedElement?.isConnected) clearLastFocusedElement.focus();
}

function clearAllPersonalData() {
  const personal = clearPersonalData();
  const prices = clearPriceData();
  const nickname = clearNickname();
  closeClearDialog();
  showToast(personal.persisted && prices.persisted && nickname.persisted
    ? "个人数据已清空"
    : "个人数据已清空，但浏览器未允许保存，请检查存储设置");
}
