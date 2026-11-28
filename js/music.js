const MUSIC_KEY = "fuen-catalog:music:v1";
const audio = document.querySelector("#background-music");
const toggle = document.querySelector("#music-enabled");
const status = document.querySelector("#music-status");
let enabled = false;

try {
  enabled = localStorage.getItem(MUSIC_KEY) === "on";
} catch (error) {
  console.warn("背景音乐设置暂时无法读取", error);
}

if (audio) audio.volume = 0.02;

function syncControls() {
  if (toggle) toggle.checked = enabled;
}

function showStatus(message) {
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

async function attemptPlayback() {
  if (!audio || !enabled) return;
  try {
    await audio.play();
    showStatus("");
  } catch (error) {
    showStatus(error.name === "NotAllowedError" ? "点击任意位置即可开启背景音乐" : "音乐暂时无法播放，请检查音频文件");
  }
}

function persist() {
  try {
    localStorage.setItem(MUSIC_KEY, enabled ? "on" : "off");
  } catch (error) {
    console.warn("背景音乐设置暂时无法保存", error);
  }
}

function setEnabled(value, save = true) {
  enabled = value;
  if (save) persist();
  syncControls();
  if (enabled) attemptPlayback();
  else {
    audio?.pause();
    showStatus("");
  }
}

toggle?.addEventListener("change", () => setEnabled(toggle.checked));

function unlockPlayback() {
  if (enabled && audio?.paused) attemptPlayback();
}

document.addEventListener("pointerdown", unlockPlayback, { passive: true });
document.addEventListener("keydown", unlockPlayback);
audio?.addEventListener("playing", () => showStatus(""));
audio?.addEventListener("error", () => showStatus("音乐暂时无法播放，请检查音频文件"));
window.addEventListener("storage", event => {
  if (event.key !== MUSIC_KEY) return;
  setEnabled(event.newValue === "on", false);
});

syncControls();
if (enabled) attemptPlayback();
