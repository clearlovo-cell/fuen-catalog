import { confirmAction } from "./dialog.js";
import { MEDIA_IDS, getMediaRecord, removeMediaRecord, saveMediaRecord, subscribeMedia } from "./local-media.js";

const DEFAULT_PHOTO = "./assets/img/uploads/series-stand.png";
const MAX_PHOTO_SIZE = 15 * 1024 * 1024;
const catalogImage = document.querySelector("#catalog-profile-photo");
const specialImage = document.querySelector("#special-profile-photo");
const openButton = document.querySelector("#profile-photo-open");
const overlay = document.querySelector("#profile-photo-overlay");
const dialog = document.querySelector("#profile-photo-dialog");
const closeButton = document.querySelector("#profile-photo-close");
const selectButton = document.querySelector("#profile-photo-select");
const saveButton = document.querySelector("#profile-photo-save");
const restoreButton = document.querySelector("#profile-photo-restore");
const fileInput = document.querySelector("#profile-photo-file");
const canvas = document.querySelector("#profile-photo-canvas");
const context = canvas.getContext("2d");
const zoomInput = document.querySelector("#profile-photo-zoom");
const zoomOutput = document.querySelector("#profile-photo-zoom-value");
const status = document.querySelector("#profile-photo-status");
let currentRecord = null;
let displayUrl = "";
let selectedUrl = "";
let editorImage = null;
let dirty = false;
let offsetX = 0;
let offsetY = 0;
let currentScale = 1;
let dragging = null;
let refreshSequence = 0;
let lastFocusedElement = null;

function showStatus(message = "") {
  status.textContent = message;
  status.hidden = !message;
}

function releaseBodyLock() {
  const otherModal = document.querySelector("#confirm-overlay:not([hidden]), #clear-data-overlay:not([hidden])");
  if (!otherModal) document.body.classList.remove("is-modal-open");
}

function clampOffsets() {
  if (!editorImage) return;
  const width = editorImage.naturalWidth * currentScale;
  const height = editorImage.naturalHeight * currentScale;
  offsetX = Math.min(0, Math.max(canvas.width - width, offsetX));
  offsetY = Math.min(0, Math.max(canvas.height - height, offsetY));
}

function drawCrop() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!editorImage) return;
  const baseScale = Math.max(canvas.width / editorImage.naturalWidth, canvas.height / editorImage.naturalHeight);
  currentScale = baseScale * Number(zoomInput.value) / 100;
  clampOffsets();
  context.drawImage(
    editorImage,
    offsetX,
    offsetY,
    editorImage.naturalWidth * currentScale,
    editorImage.naturalHeight * currentScale
  );
}

function resetCrop() {
  zoomInput.value = "100";
  zoomOutput.textContent = "100%";
  if (!editorImage) return;
  const baseScale = Math.max(canvas.width / editorImage.naturalWidth, canvas.height / editorImage.naturalHeight);
  currentScale = baseScale;
  offsetX = (canvas.width - editorImage.naturalWidth * currentScale) / 2;
  offsetY = (canvas.height - editorImage.naturalHeight * currentScale) / 2;
  drawCrop();
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效");
  return image;
}

function sizeCanvasToCard() {
  const rect = specialImage.getBoundingClientRect();
  const ratio = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 0.64;
  canvas.width = 480;
  canvas.height = Math.min(900, Math.max(480, Math.round(canvas.width / ratio)));
}

async function prepareEditor(url) {
  editorImage = await loadImage(url);
  resetCrop();
}

async function refreshPhoto() {
  const sequence = ++refreshSequence;
  try {
    const record = await getMediaRecord(MEDIA_IDS.profilePhoto);
    if (sequence !== refreshSequence) return;
    currentRecord = record;
    if (displayUrl) URL.revokeObjectURL(displayUrl);
    displayUrl = record ? URL.createObjectURL(record.blob) : "";
    const source = displayUrl || DEFAULT_PHOTO;
    catalogImage.src = source;
    specialImage.src = source;
    restoreButton.disabled = !record;
  } catch (error) {
    showStatus(error.message || "收藏卡照片读取失败");
  }
}

async function openEditor() {
  lastFocusedElement = document.activeElement;
  sizeCanvasToCard();
  showStatus("");
  dirty = false;
  saveButton.disabled = true;
  overlay.hidden = false;
  document.body.classList.add("is-modal-open");
  requestAnimationFrame(() => closeButton.focus());
  try {
    await prepareEditor(displayUrl || DEFAULT_PHOTO);
  } catch {
    showStatus("当前照片无法读取，请重新选择图片");
  }
}

function closeEditor() {
  overlay.hidden = true;
  dirty = false;
  saveButton.disabled = true;
  if (selectedUrl) {
    URL.revokeObjectURL(selectedUrl);
    selectedUrl = "";
  }
  releaseBodyLock();
  if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
}

async function requestCloseEditor() {
  if (dirty) {
    const confirmed = await confirmAction({
      title: "放弃未保存的裁剪？",
      description: "当前调整尚未保存，关闭后将丢失。",
      confirmLabel: "放弃修改",
      danger: true
    });
    if (!confirmed) return;
  }
  closeEditor();
}

openButton.addEventListener("click", openEditor);
closeButton.addEventListener("click", requestCloseEditor);
overlay.addEventListener("click", event => {
  if (event.target === overlay) requestCloseEditor();
});

selectButton.addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  let candidateUrl = "";
  try {
    if (file.size > MAX_PHOTO_SIZE) throw new Error("照片不能超过 15MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("请选择 JPEG、PNG 或 WebP 图片");
    }
    showStatus("正在读取照片…");
    candidateUrl = URL.createObjectURL(file);
    const image = await loadImage(candidateUrl);
    if (selectedUrl) URL.revokeObjectURL(selectedUrl);
    selectedUrl = candidateUrl;
    candidateUrl = "";
    editorImage = image;
    dirty = true;
    saveButton.disabled = false;
    resetCrop();
    showStatus("调整位置和缩放后保存");
  } catch (error) {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
    showStatus(error.message || "照片读取失败");
  } finally {
    fileInput.value = "";
  }
});

zoomInput.addEventListener("input", () => {
  if (!editorImage) return;
  const oldScale = currentScale;
  const centerX = (canvas.width / 2 - offsetX) / oldScale;
  const centerY = (canvas.height / 2 - offsetY) / oldScale;
  const baseScale = Math.max(canvas.width / editorImage.naturalWidth, canvas.height / editorImage.naturalHeight);
  const nextScale = baseScale * Number(zoomInput.value) / 100;
  offsetX = canvas.width / 2 - centerX * nextScale;
  offsetY = canvas.height / 2 - centerY * nextScale;
  zoomOutput.textContent = `${zoomInput.value}%`;
  drawCrop();
});

canvas.addEventListener("pointerdown", event => {
  if (!editorImage) return;
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  dragging = {
    x: event.clientX,
    y: event.clientY,
    offsetX,
    offsetY,
    scaleX: canvas.width / rect.width,
    scaleY: canvas.height / rect.height
  };
});

canvas.addEventListener("pointermove", event => {
  if (!dragging) return;
  offsetX = dragging.offsetX + (event.clientX - dragging.x) * dragging.scaleX;
  offsetY = dragging.offsetY + (event.clientY - dragging.y) * dragging.scaleY;
  drawCrop();
});

canvas.addEventListener("pointerup", () => { dragging = null; });
canvas.addEventListener("pointercancel", () => { dragging = null; });
canvas.addEventListener("keydown", event => {
  const movements = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
  const movement = movements[event.key];
  if (!movement || !editorImage) return;
  event.preventDefault();
  offsetX += movement[0];
  offsetY += movement[1];
  drawCrop();
});

saveButton.addEventListener("click", async () => {
  if (!dirty || !editorImage) return;
  try {
    saveButton.disabled = true;
    showStatus("正在保存照片…");
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("照片处理失败，请更换图片后重试");
    await saveMediaRecord(MEDIA_IDS.profilePhoto, blob, "收藏卡照片.webp");
    closeEditor();
  } catch (error) {
    saveButton.disabled = false;
    showStatus(error.message || "照片保存失败，请检查浏览器存储设置");
  }
});

restoreButton.addEventListener("click", async () => {
  if (!currentRecord) return;
  const confirmed = await confirmAction({
    title: "恢复默认图片？",
    description: "将删除当前浏览器中的自定义收藏卡照片，此操作无法撤销。",
    confirmLabel: "恢复默认",
    danger: true
  });
  if (!confirmed) return;
  try {
    await removeMediaRecord(MEDIA_IDS.profilePhoto);
    closeEditor();
  } catch (error) {
    showStatus(error.message || "默认图片恢复失败");
  }
});

subscribeMedia(detail => {
  if (detail.id === "*" || detail.id === MEDIA_IDS.profilePhoto) refreshPhoto();
});

document.addEventListener("keydown", event => {
  if (overlay.hidden || !document.querySelector("#confirm-overlay").hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    requestCloseEditor();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), canvas[tabindex]')]
    .filter(element => element.getClientRects().length > 0);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

refreshPhoto();
