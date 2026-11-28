const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|wav|flac)$/i;

export async function validateAudioFile(file, maxSize) {
  if (!file) throw new Error("请选择音频文件");
  if (file.size > maxSize) throw new Error(`音频文件不能超过 ${Math.round(maxSize / 1024 / 1024)}MB`);
  if (!file.type.startsWith("audio/") && !AUDIO_EXTENSIONS.test(file.name)) {
    throw new Error("请选择常见的音频文件");
  }
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = "metadata";
  try {
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("音频读取超时，请检查文件")), 10000);
      audio.addEventListener("loadedmetadata", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      audio.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("浏览器无法解码此音频，请更换格式"));
      }, { once: true });
      audio.src = url;
    });
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
  return file;
}
