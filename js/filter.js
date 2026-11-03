/** 将 CMS 中的材质文本拆成可筛选的单项。 */
export function splitMaterials(value = "") {
  return [...new Set(String(value).split(/[、;；]/).map(item => item.trim()).filter(Boolean))];
}

/**
 * 纯函数：所有筛选条件可叠加；材质多选采用“或”逻辑。
 * @param {Array} allData 谷子完整数组
 * @param {Object} filters { seriesId,type,platforms,event,year,release_type,search,materials,hasSize }
 */
export function filterGoods(allData, filters) {
  const keyword = String(filters.search || "").trim().toLocaleLowerCase("zh-CN");
  const selectedPlatforms = filters.platforms || [];
  const selectedMaterials = filters.materials || [];

  return allData.filter(item => {
    if (filters.seriesId && item.series !== filters.seriesId) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (selectedPlatforms.length && !selectedPlatforms.some(value => (item.platforms || []).includes(value))) return false;
    if (filters.event && item.event !== filters.event) return false;
    if (filters.year && String(item.year) !== String(filters.year)) return false;
    if (filters.release_type && item.release_type !== filters.release_type) return false;
    if (filters.hasSize && !String(item.size || "").trim()) return false;
    if (selectedMaterials.length) {
      const itemMaterials = splitMaterials(item.material);
      if (!selectedMaterials.some(value => itemMaterials.includes(value))) return false;
    }
    if (keyword) {
      const haystack = [item.name, item.seriesName, item.type, item.event, item.year, item.note, item.material, ...(item.platforms || [])]
        .filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

export function uniqueValues(items, key) {
  const values = items.flatMap(item => {
    const value = item[key];
    return Array.isArray(value) ? value : [value];
  }).filter(value => value !== undefined && value !== null && String(value).trim());
  return [...new Set(values.map(String))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}
