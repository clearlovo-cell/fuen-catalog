import { validateAudioFile } from "./audio-file.js";
import { preparePlayback, setPlaybackVolume } from "./audio-engine.js";
import { MEDIA_IDS, getMediaRecord, removeMediaRecord, saveMediaRecord, subscribeMedia } from "./local-media.js";
import { getSoundPreferences, setMenuVoiceEnabled, setMenuVoiceVolume, subscribeSound } from "./sound.js";

const MAX_VOICE_SIZE = 10 * 1024 * 1024;
const enabledInput = document.querySelector("#menu-voice-enabled");
const volumeInput = document.querySelector("#menu-voice-volume");
const volumeOutput = document.querySelector("#menu-voice-volume-value");
const fileInput = document.querySelector("#menu-voice-file");
const status = document.querySelector("#menu-voice-status");
const rows = [...document.querySelectorAll("[data-voice-slot]")];
const records = new Map();
const objectUrls = new Map();
const voiceAudio = new Audio();
let selectedSlot = 1;
let lastFallbackId = "";
let refreshSequence = 0;
let playSequence = 0;
let voicePlaying = false;

function showStatus(message = "") {
  status.textContent = message;
  status.hidden = !message;
}

function mediaId(slot) {
  return MEDIA_IDS.menuVoices[slot - 1];
}

function syncPreferences() {
  const preferences = getSoundPreferences();
  enabledInput.checked = preferences.menuVoiceEnabled;
  volumeInput.value = String(Math.round(preferences.menuVoiceVolume * 100));
  volumeOutput.textContent = `${volumeInput.value}%`;
  setPlaybackVolume(voiceAudio, preferences.menuVoiceVolume);
}

function syncRows() {
  rows.forEach(row => {
    const slot = Number(row.dataset.voiceSlot);
    const record = records.get(mediaId(slot));
    const state = row.querySelector("[data-voice-state]");
    state.textContent = record?.name || "未导入";
    state.title = record?.name || "";
    row.querySelector('[data-voice-action="select"]').textContent = record ? "替换" : "选择";
    row.querySelector('[data-voice-action="preview"]').disabled = records.size === 0;
    row.querySelector('[data-voice-action="remove"]').disabled = !record;
  });
}

function setVoicePlaying(playing) {
  window.dispatchEvent(new CustomEvent("fuen-menu-voice-state", { detail: { playing } }));
}

function stopVoice() {
  playSequence += 1;
  voiceAudio.pause();
  if (!voicePlaying) return;
  voicePlaying = false;
  setVoicePlaying(false);
}

function voiceUrl(id) {
  if (!objectUrls.has(id)) objectUrls.set(id, URL.createObjectURL(records.get(id).blob));
  return objectUrls.get(id);
}

async function playSlot(slot, { preview = false } = {}) {
  const preferences = getSoundPreferences();
  if (!preferences.enabled) {
    showStatus("全站声音已关闭，请先开启“声音”");
    return;
  }
  if (!preview && !preferences.menuVoiceEnabled) return;
  const ownId = mediaId(slot);
  let selectedId = records.has(ownId) ? ownId : "";
  if (!selectedId) {
    const pool = [...records.keys()];
    if (!pool.length) return;
    const candidates = pool.length > 1 ? pool.filter(id => id !== lastFallbackId) : pool;
    selectedId = candidates[Math.floor(Math.random() * candidates.length)];
    lastFallbackId = selectedId;
  }
  stopVoice();
  const sequence = playSequence;
  voiceAudio.src = voiceUrl(selectedId);
  voiceAudio.load();
  try {
    await preparePlayback(voiceAudio, getSoundPreferences().menuVoiceVolume);
    await voiceAudio.play();
    if (sequence !== playSequence || voiceAudio.ended) return;
    voicePlaying = true;
    setVoicePlaying(true);
    showStatus("");
  } catch (error) {
    if (sequence !== playSequence) return;
    voicePlaying = false;
    setVoicePlaying(false);
    showStatus(error.name === "NotAllowedError" ? "请再次点击后重试" : "这条语音暂时无法播放");
  }
}

voiceAudio.addEventListener("ended", () => {
  voicePlaying = false;
  setVoicePlaying(false);
});

voiceAudio.addEventListener("error", () => {
  if (!voiceAudio.error) return;
  voicePlaying = false;
  setVoicePlaying(false);
  showStatus("这条语音暂时无法播放，请检查音频文件");
});

async function refreshVoices() {
  const sequence = ++refreshSequence;
  try {
    const loaded = await Promise.all(MEDIA_IDS.menuVoices.map(id => getMediaRecord(id)));
    if (sequence !== refreshSequence) return;
    stopVoice();
    records.clear();
    loaded.forEach(record => {
      if (record) records.set(record.id, record);
    });
    for (const [id, url] of objectUrls) {
      if (!records.has(id)) {
        URL.revokeObjectURL(url);
        objectUrls.delete(id);
      }
    }
    syncRows();
  } catch (error) {
    showStatus(error.message || "菜单语音读取失败");
  }
}

rows.forEach(row => {
  row.addEventListener("click", async event => {
    const button = event.target.closest("[data-voice-action]");
    if (!button) return;
    const slot = Number(row.dataset.voiceSlot);
    const action = button.dataset.voiceAction;
    if (action === "select") {
      selectedSlot = slot;
      fileInput.value = "";
      fileInput.click();
    }
    if (action === "preview") await playSlot(slot, { preview: true });
    if (action === "remove") {
      try {
        await removeMediaRecord(mediaId(slot));
        showStatus(`语音 ${slot} 已移除`);
      } catch (error) {
        showStatus(error.message || "语音移除失败");
      }
    }
  });
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    showStatus(`正在读取语音 ${selectedSlot}…`);
    await validateAudioFile(file, MAX_VOICE_SIZE);
    await saveMediaRecord(mediaId(selectedSlot), file, file.name);
    showStatus(`语音 ${selectedSlot} 已保存在当前浏览器`);
  } catch (error) {
    showStatus(error.message || "语音保存失败，请检查浏览器存储设置");
  } finally {
    fileInput.value = "";
  }
});

enabledInput.addEventListener("change", () => setMenuVoiceEnabled(enabledInput.checked));
volumeInput.addEventListener("input", () => setMenuVoiceVolume(Number(volumeInput.value) / 100));

subscribeSound(preferences => {
  if (!preferences.enabled || !preferences.menuVoiceEnabled) stopVoice();
  syncPreferences();
});

subscribeMedia(detail => {
  if (detail.id === "*" || MEDIA_IDS.menuVoices.includes(detail.id)) refreshVoices();
});

document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("[data-menu-voice-slot]");
  if (!link) return;
  const targetHash = link.getAttribute("href");
  if (!targetHash?.startsWith("#/") || targetHash === location.hash) return;
  playSlot(Number(link.dataset.menuVoiceSlot));
});

syncPreferences();
syncRows();
refreshVoices();
