import { createBackup as createPersonalBackup, importBackup as importPersonalBackup } from "./storage.js";
import { createPriceBackup, importPriceBackup, validatePriceBackup } from "./prices.js";

/** 个人列表沿用原备份格式，金额数量作为可选数据附加在同一个文件中。 */
export function createBackup() {
  return { ...createPersonalBackup(), prices: createPriceBackup() };
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  // 先校验新增数据，避免个人列表合并后才发现金额数据版本不兼容。
  validatePriceBackup(parsed);
  const counts = importPersonalBackup(text);
  const priceCounts = importPriceBackup(parsed);
  return { ...counts, priceCounts };
}
