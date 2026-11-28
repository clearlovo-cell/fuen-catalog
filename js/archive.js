const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function set16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function set32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function dosTimestamp(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

export async function createZipArchive(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let centralSize = 0;
  const timestamp = dosTimestamp(new Date());

  for (const file of files) {
    const name = textEncoder.encode(file.name);
    const data = file.data;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    set32(localView, 0, 0x04034B50);
    set16(localView, 4, 20);
    set16(localView, 6, 0x0800);
    set16(localView, 8, 0);
    set16(localView, 10, timestamp.time);
    set16(localView, 12, timestamp.date);
    set32(localView, 14, checksum);
    set32(localView, 18, data.length);
    set32(localView, 22, data.length);
    set16(localView, 26, name.length);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    set32(centralView, 0, 0x02014B50);
    set16(centralView, 4, 20);
    set16(centralView, 6, 20);
    set16(centralView, 8, 0x0800);
    set16(centralView, 10, 0);
    set16(centralView, 12, timestamp.time);
    set16(centralView, 14, timestamp.date);
    set32(centralView, 16, checksum);
    set32(centralView, 20, data.length);
    set32(centralView, 24, data.length);
    set16(centralView, 28, name.length);
    set32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  set32(endView, 0, 0x06054B50);
  set16(endView, 8, files.length);
  set16(endView, 10, files.length);
  set32(endView, 12, centralSize);
  set32(endView, 16, localOffset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

export async function readZipArchive(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  const earliest = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054B50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("备份压缩包格式不正确");
  const count = view.getUint16(endOffset + 10, true);
  if (count > 32) throw new Error("备份压缩包包含过多文件");
  let centralOffset = view.getUint32(endOffset + 16, true);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014B50) throw new Error("备份压缩包目录损坏");
    const method = view.getUint16(centralOffset + 10, true);
    if (method !== 0) throw new Error("请使用本网站导出的备份压缩包");
    const size = view.getUint32(centralOffset + 24, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = textDecoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034B50) throw new Error("备份压缩包内容损坏");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    if (start + size > bytes.length) throw new Error("备份压缩包内容不完整");
    entries.set(name, bytes.slice(start, start + size));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
