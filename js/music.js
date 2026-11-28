import { validateAudioFile } from "./audio-file.js";
import { confirmAction } from "./dialog.js";
import { MEDIA_IDS, getMediaRecord, removeMediaRecord, saveMediaRecord, subscribeMedia } from "./local-media.js";
import { getSoundPreferences, setBackgroundVolume, subscribeSound } from "./sound.js";

const MAX_MUSIC_SIZE = 40 * 1024 * 1024;
const audio = document.querySelector("#background-music");
const selectButton = document.querySelector("#background-music-select");
const playButton = document.querySelector("#background-music-play");
const removeButton = document.querySelector("#background-music-remove");
const fileInput = document.querySelector("#background-music-file");
const nameLabel = document.querySelector("#background-music-name");
const status = document.querySelector("#background-music-status");
const volumeInput = document.querySelector("#background-music-volume");
const volumeOutput = document.querySelector("#background-music-volume-value");
let currentRecord = null;
let objectUrl = "";
let loadSequence = 0;
let voicePlaying = false;

function showStatus(message = "") {
  status.textContent = message;
  status.hidden = !message;
}

function syncVolume() {
  const preferences = getSoundPreferences();
  audio.volume = preferences.backgroundVolume * (voicePlaying ? 0.35 : 1);
  volumeInput.value = String(Math.round(preferences.backgroundVolume * 100));
  volumeOutput.textContent = `${volumeInput.value}%`;
}

function syncControls() {
  playButton.disabled = !currentRecord;
  removeButton.disabled = !currentRecord;
  selectButton.textContent = currentRecord ? "替换音乐" : "选择音乐";
  playButton.textContent = audio.paused ? "播放" : "暂停";
  nameLabel.textContent = currentRecord?.name || "未导入";
  nameLabel.title = currentRecord?.name || "";
}

async function refreshMusic() {
  const sequence = ++loadSequence;
  try {
    const record = await getMediaRecord(MEDIA_IDS.backgroundMusic);
    if (sequence !== loadSequence) return;
    currentRecord = record;
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = record ? URL.createObjectURL(record.blob) : "";
    if (record) audio.src = objectUrl;
    else audio.removeAttribute("src");
    syncControls();
    syncVolume();
  } catch (error) {
    showStatus(error.message || "本地音乐读取失败");
  }
}

selectButton.addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    showStatus("正在读取音乐…");
    await validateAudioFile(file, MAX_MUSIC_SIZE);
    await saveMediaRecord(MEDIA_IDS.backgroundMusic, file, file.name);
    showStatus("音乐已保存在当前浏览器");
  } catch (error) {
    showStatus(error.message || "音乐保存失败，请检查浏览器存储设置");
  } finally {
    fileInput.value = "";
  }
});

playButton.addEventListener("click", async () => {
  if (!currentRecord) return;
  if (!audio.paused) {
    audio.pause();
    return;
  }
  if (!getSoundPreferences().enabled) {
    showStatus("全站声音已关闭，请先开启“声音”");
    return;
  }
  try {
    await audio.play();
    showStatus("");
  } catch (error) {
    showStatus(error.name === "NotAllowedError" ? "请再次点击播放" : "音乐暂时无法播放，请检查音频文件");
  }
});

removeButton.addEventListener("click", async () => {
  const confirmed = await confirmAction({
    title: "移除背景音乐？",
    description: "将从当前浏览器删除这首音乐，音量设置会保留。",
    confirmLabel: "移除音乐",
    danger: true
  });
  if (!confirmed) return;
  try {
    await removeMediaRecord(MEDIA_IDS.backgroundMusic);
    showStatus("背景音乐已移除");
  } catch (error) {
    showStatus(error.message || "音乐移除失败");
  }
});

volumeInput.addEventListener("input", () => setBackgroundVolume(Number(volumeInput.value) / 100));
audio.addEventListener("play", syncControls);
audio.addEventListener("pause", syncControls);
audio.addEventListener("playing", () => showStatus(""));
audio.addEventListener("error", () => {
  if (currentRecord) showStatus("音乐暂时无法播放，请检查音频文件");
});

subscribeSound(preferences => {
  if (!preferences.enabled) audio.pause();
  syncVolume();
});

subscribeMedia(detail => {
  if (detail.id === "*" || detail.id === MEDIA_IDS.backgroundMusic) refreshMusic();
});

window.addEventListener("fuen-menu-voice-state", event => {
  voicePlaying = Boolean(event.detail?.playing);
  syncVolume();
});

syncVolume();
syncControls();
refreshMusic();
