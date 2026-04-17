export function problemVisible(n, problems, filters, isDone, hasTag, companySets) {
  const p = problems[String(n)];
  if (!p) return false;
  if (filters.diffFilter.size > 0 && !filters.diffFilter.has(p.diff)) return false;
  if (filters.search && !(p.name + ' ' + n).toLowerCase().includes(filters.search)) return false;
  if (filters.showUnsolved && isDone(n)) return false;
  if (filters.redoOnly && !hasTag(n, 'redo')) return false;
  if (filters.companyFilter.size > 0) {
    const inAny = [...filters.companyFilter].some(k => companySets[k]?.has(n));
    if (!inAny) return false;
  }
  return true;
}

export function countVisible(arr, problems, filters, isDone, hasTag, companySets) {
  return arr.filter(n => problemVisible(n, problems, filters, isDone, hasTag, companySets)).length;
}
