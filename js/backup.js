import { createBackup as createPersonalBackup, importBackup as importPersonalBackup } from "./storage.js";
import { createPriceBackup, importPriceBackup, validatePriceBackup } from "./prices.js";
import { getNickname, importNickname } from "./nickname.js";

export function createBackup() {
  return { ...createPersonalBackup(), prices: createPriceBackup(), nickname: getNickname() };
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  validatePriceBackup(parsed);
  const counts = importPersonalBackup(text);
  const priceCounts = importPriceBackup(parsed);
  importNickname(parsed.nickname);
  return { ...counts, priceCounts };
}
