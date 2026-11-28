import { createBackup as createPersonalBackup, importBackup as importPersonalBackup } from "./storage.js";
import { createPriceBackup, importPriceBackup, validatePriceBackup } from "./prices.js";
import { getNickname, getSlogan, getTitleConnector, importNickname, importSlogan, importTitleConnector } from "./nickname.js";

export function createBackup() {
  return {
    ...createPersonalBackup(),
    prices: createPriceBackup(),
    nickname: getNickname(),
    slogan: getSlogan(),
    titleConnector: getTitleConnector()
  };
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  validatePriceBackup(parsed);
  const counts = importPersonalBackup(text);
  const priceCounts = importPriceBackup(parsed);
  importNickname(parsed.nickname);
  importSlogan(parsed.slogan);
  importTitleConnector(parsed.titleConnector);
  return { ...counts, priceCounts };
}
