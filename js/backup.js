import { createBackup as createPersonalBackup, importBackup as importPersonalBackup, validateBackup } from "./storage.js";
import { createPriceBackup, importPriceBackup, validatePriceBackup } from "./prices.js";
import { getNickname, getSlogan, getTitleConnector, importNickname, importSlogan, importTitleConnector } from "./nickname.js";
import { getMediaRecord, saveMediaRecord, MEDIA_IDS } from "./local-media.js";
import { getSoundPreferences, importSoundPreferences } from "./sound.js";
import { createZipArchive, readZipArchive } from "./archive.js";
import { validateAudioFile } from "./audio-file.js";

const MEDIA_VERSION = 1;
const MAX_ARCHIVE_SIZE = 160 * 1024 * 1024;
const MAX_JSON_SIZE = 2 * 1024 * 1024;
const MAX_MUSIC_SIZE = 40 * 1024 * 1024;
const MAX_VOICE_SIZE = 10 * 1024 * 1024;
const MAX_PHOTO_SIZE = 15 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createBasicBackup() {
  return {
    ...createPersonalBackup(),
    prices: createPriceBackup(),
    nickname: getNickname(),
    slogan: getSlogan(),
    titleConnector: getTitleConnector(),
    sound: getSoundPreferences()
  };
}

function importBasicBackup(manifest) {
  const counts = importPersonalBackup(JSON.stringify(manifest));
  const priceCounts = importPriceBackup(manifest);
  importNickname(manifest.nickname);
  importSlogan(manifest.slogan);
  importTitleConnector(manifest.titleConnector);
  importSoundPreferences(manifest.sound);
  return { ...counts, priceCounts };
}

export async function createBackupArchive({ includeAudio = false } = {}) {
  const manifest = createBasicBackup();
  manifest.mediaVersion = MEDIA_VERSION;
  manifest.media = {};
  const files = [];

  async function addMedia(record, path, section, slot = "") {
    const data = new Uint8Array(await record.blob.arrayBuffer());
    files.push({ name: path, data });
    const descriptor = { path, name: record.name, type: record.type };
    if (section === "menuVoices") {
      manifest.media.menuVoices ||= {};
      manifest.media.menuVoices[slot] = descriptor;
    } else {
      manifest.media[section] = descriptor;
    }
  }

  const photo = await getMediaRecord(MEDIA_IDS.profilePhoto);
  if (photo) await addMedia(photo, "media/profile-photo", "profilePhoto");
  if (includeAudio) {
    const music = await getMediaRecord(MEDIA_IDS.backgroundMusic);
    if (music) await addMedia(music, "media/background-music", "backgroundMusic");
    for (let slot = 1; slot <= MEDIA_IDS.menuVoices.length; slot += 1) {
      const voice = await getMediaRecord(MEDIA_IDS.menuVoices[slot - 1]);
      if (voice) await addMedia(voice, `media/menu-voice-${slot}`, "menuVoices", String(slot));
    }
  }

  files.unshift({ name: "manifest.json", data: encoder.encode(JSON.stringify(manifest, null, 2)) });
  return createZipArchive(files);
}

function mediaFile(descriptor, fallbackName) {
  if (!descriptor) return null;
  if (typeof descriptor.path !== "string") throw new Error("备份中的媒体信息不正确");
  return { descriptor, fallbackName };
}

async function parseArchive(file) {
  const entries = await readZipArchive(file);
  const manifestBytes = entries.get("manifest.json");
  if (!manifestBytes) throw new Error("备份中缺少数据清单");
  const manifest = JSON.parse(decoder.decode(manifestBytes));
  validateBackup(manifest);
  validatePriceBackup(manifest);
  if (Number(manifest.mediaVersion || 1) > MEDIA_VERSION) throw new Error("媒体备份版本较新，请先更新网站");
  const media = new Map();
  const source = manifest.media && typeof manifest.media === "object" ? manifest.media : {};
  const definitions = [
    [MEDIA_IDS.profilePhoto, mediaFile(source.profilePhoto, "收藏卡照片.webp"), MAX_PHOTO_SIZE],
    [MEDIA_IDS.backgroundMusic, mediaFile(source.backgroundMusic, "背景音乐"), MAX_MUSIC_SIZE]
  ];
  MEDIA_IDS.menuVoices.forEach((id, index) => {
    definitions.push([id, mediaFile(source.menuVoices?.[String(index + 1)], `菜单语音 ${index + 1}`), MAX_VOICE_SIZE]);
  });

  for (const [id, item, maxSize] of definitions) {
    if (!item) continue;
    const bytes = entries.get(item.descriptor.path);
    if (!bytes) throw new Error("备份中的媒体文件不完整");
    if (bytes.length > maxSize) throw new Error("备份中的媒体文件过大");
    const name = String(item.descriptor.name || item.fallbackName);
    const type = String(item.descriptor.type || "application/octet-stream");
    media.set(id, { id, file: new File([bytes], name, { type }) });
  }
  return { manifest, media };
}

export async function readBackupFile(file) {
  if (!file) throw new Error("请选择备份文件");
  if (file.size > MAX_ARCHIVE_SIZE) throw new Error("备份文件过大，请选择本网站导出的文件");
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = signature[0] === 0x50 && signature[1] === 0x4B && signature[2] === 3 && signature[3] === 4;
  if (isZip) return parseArchive(file);
  if (file.size > MAX_JSON_SIZE) throw new Error("旧版 JSON 备份过大，请选择本网站导出的文件");
  const manifest = JSON.parse(await file.text());
  validateBackup(manifest);
  validatePriceBackup(manifest);
  return { manifest, media: new Map() };
}

export async function getBackupMediaConflicts(backup) {
  const conflicts = [];
  for (const id of backup.media.keys()) {
    if (await getMediaRecord(id)) conflicts.push(id);
  }
  return conflicts;
}

export async function applyBackup(backup) {
  for (const [id, item] of backup.media) {
    if (id === MEDIA_IDS.backgroundMusic) await validateAudioFile(item.file, MAX_MUSIC_SIZE);
    if (MEDIA_IDS.menuVoices.includes(id)) await validateAudioFile(item.file, MAX_VOICE_SIZE);
  }
  const counts = importBasicBackup(backup.manifest);
  for (const item of backup.media.values()) {
    await saveMediaRecord(item.id, item.file, item.file.name);
  }
  return counts;
}
