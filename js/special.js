import { applyBackup, createBackupArchive, getBackupMediaConflicts, readBackupFile } from "./backup.js";
import { clearPersonalData } from "./storage.js";
import { clearPriceData } from "./prices.js";
import { clearProfile } from "./nickname.js";
import { clearMediaRecords } from "./local-media.js";
import { confirmAction } from "./dialog.js";
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
      const focusable = [document.querySelector("#clear-include-media"), cancelClearButton, confirmClearButton];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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

async function exportPersonalData() {
  try {
    const includeAudio = document.querySelector("#backup-include-audio").checked;
    const blob = await createBackupArchive({ includeAudio });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `斐恩图鉴备份-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("备份已导出，请妥善保存文件");
  } catch (error) {
    showToast(error.message || "备份导出失败，请检查浏览器存储设置");
  }
}

async function importPersonalData() {
  const file = backupFile.files?.[0];
  if (!file) return;
  try {
    const backup = await readBackupFile(file);
    const conflicts = await getBackupMediaConflicts(backup);
    if (conflicts.length) {
      const confirmed = await confirmAction({
        title: "替换现有本地媒体？",
        description: `备份中有 ${conflicts.length} 项媒体与当前设备重复，继续导入将替换对应照片或音频。其他媒体会保留。`,
        confirmLabel: "替换并导入",
        danger: true
      });
      if (!confirmed) return;
    }
    const counts = await applyBackup(backup);
    showToast(`备份已合并：仓库 ${counts.owned} 条，心愿 ${counts.wishlist} 条，媒体 ${backup.media.size} 项`);
  } catch (error) {
    showToast(error.message || "备份导入失败，请检查文件");
  } finally {
    backupFile.value = "";
  }
}

function openClearDialog() {
  clearLastFocusedElement = document.activeElement;
  document.querySelector("#clear-include-media").checked = false;
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

async function clearAllPersonalData() {
  const personal = clearPersonalData();
  const prices = clearPriceData();
  const profile = clearProfile();
  let mediaCleared = true;
  if (document.querySelector("#clear-include-media").checked) {
    try {
      await clearMediaRecords();
    } catch {
      mediaCleared = false;
    }
  }
  closeClearDialog();
  showToast(personal.persisted && prices.persisted && profile.persisted && mediaCleared
    ? "个人数据已清空"
    : "个人数据已清空，但部分本地内容未能保存或删除，请检查存储设置");
}
