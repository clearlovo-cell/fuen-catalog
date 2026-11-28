const SOUND_KEY = "fuen-catalog:sound:v1";
const BGM_VOLUME_KEY = "fuen-catalog:bgm-volume:v1";
const VOICE_ENABLED_KEY = "fuen-catalog:menu-voice:v1";
const VOICE_VOLUME_KEY = "fuen-catalog:menu-voice-volume:v1";
const LEGACY_MUSIC_KEY = "fuen-catalog:music:v1";
const KEYS = [SOUND_KEY, BGM_VOLUME_KEY, VOICE_ENABLED_KEY, VOICE_VOLUME_KEY];

function read(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function volume(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
}

let preferences = {
  enabled: read(SOUND_KEY, "on") !== "off",
  backgroundVolume: volume(read(BGM_VOLUME_KEY, "0.35"), 0.35),
  menuVoiceEnabled: read(VOICE_ENABLED_KEY, "on") !== "off",
  menuVoiceVolume: volume(read(VOICE_VOLUME_KEY, "0.8"), 0.8)
};

try {
  localStorage.removeItem(LEGACY_MUSIC_KEY);
} catch {}

const toggle = document.querySelector("#sound-enabled");
const listeners = new Set();

function notify() {
  toggle.checked = preferences.enabled;
  listeners.forEach(listener => listener({ ...preferences }));
}

export function getSoundPreferences() {
  return { ...preferences };
}

export function setSoundEnabled(value) {
  preferences.enabled = Boolean(value);
  const persisted = write(SOUND_KEY, preferences.enabled ? "on" : "off");
  notify();
  return { persisted };
}

export function setBackgroundVolume(value) {
  preferences.backgroundVolume = volume(value, preferences.backgroundVolume);
  const persisted = write(BGM_VOLUME_KEY, preferences.backgroundVolume);
  notify();
  return { persisted };
}

export function setMenuVoiceEnabled(value) {
  preferences.menuVoiceEnabled = Boolean(value);
  const persisted = write(VOICE_ENABLED_KEY, preferences.menuVoiceEnabled ? "on" : "off");
  notify();
  return { persisted };
}

export function setMenuVoiceVolume(value) {
  preferences.menuVoiceVolume = volume(value, preferences.menuVoiceVolume);
  const persisted = write(VOICE_VOLUME_KEY, preferences.menuVoiceVolume);
  notify();
  return { persisted };
}

export function importSoundPreferences(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.enabled === "boolean") {
    preferences.enabled = value.enabled;
    write(SOUND_KEY, value.enabled ? "on" : "off");
  }
  if (typeof value.backgroundVolume === "number") {
    preferences.backgroundVolume = volume(value.backgroundVolume, preferences.backgroundVolume);
    write(BGM_VOLUME_KEY, preferences.backgroundVolume);
  }
  if (typeof value.menuVoiceEnabled === "boolean") {
    preferences.menuVoiceEnabled = value.menuVoiceEnabled;
    write(VOICE_ENABLED_KEY, value.menuVoiceEnabled ? "on" : "off");
  }
  if (typeof value.menuVoiceVolume === "number") {
    preferences.menuVoiceVolume = volume(value.menuVoiceVolume, preferences.menuVoiceVolume);
    write(VOICE_VOLUME_KEY, preferences.menuVoiceVolume);
  }
  notify();
}

export function subscribeSound(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

toggle?.addEventListener("change", () => setSoundEnabled(toggle.checked));

window.addEventListener("storage", event => {
  if (!KEYS.includes(event.key)) return;
  preferences = {
    enabled: read(SOUND_KEY, "on") !== "off",
    backgroundVolume: volume(read(BGM_VOLUME_KEY, "0.35"), 0.35),
    menuVoiceEnabled: read(VOICE_ENABLED_KEY, "on") !== "off",
    menuVoiceVolume: volume(read(VOICE_VOLUME_KEY, "0.8"), 0.8)
  };
  notify();
});

notify();
