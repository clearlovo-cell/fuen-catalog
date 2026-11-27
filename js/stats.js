import { getIds } from "./storage.js";
import { getPriceRecord } from "./prices.js";

export function getCollectionStats(goods) {
  const goodsById = new Map(goods.map(item => [String(item.id), item]));
  const validIds = kind => getIds(kind).filter(id => goodsById.has(String(id)));
  const ownedIds = validIds("owned");
  const wishlistIds = validIds("wishlist");
  const total = goods.length;
  const owned = ownedIds.length;
  const wishlist = wishlistIds.length;
  return {
    total,
    owned,
    wishlist,
    ownedAmount: amountFor("owned", ownedIds),
    wishlistAmount: amountFor("wishlist", wishlistIds),
    ownedPercent: total ? Math.round(owned / total * 100) : 0,
    wishlistPercent: total ? Math.round(wishlist / total * 100) : 0
  };
}

function amountFor(kind, ids) {
  return ids.reduce((sum, id) => {
    const record = getPriceRecord(kind, id);
    return record?.price === null || !record ? sum : sum + record.price * record.qty;
  }, 0);
}
