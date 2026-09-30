type Page<T> = { data: T[] | null; error: unknown; count: number | null };

/** Load a complete, consistently ordered result even when the API caps page size. */
export async function loadAllPages<T>(
  fetchPage: (from: number, to: number, includeCount: boolean) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const first = await fetchPage(0, 499, true);
  if (first.error || first.count === null || !first.data) {
    throw new Error("Could not load the complete study data.");
  }
  const total = first.count;
  if (total === 0) return [];
  const pageSize = first.data.length;
  if (pageSize === 0) {
    throw new Error("Study data is incomplete. Please retry.");
  }
  const pages: T[][] = [first.data];
  for (let start = pageSize; start < total; start += pageSize * 4) {
    const ranges = Array.from({ length: Math.min(4, Math.ceil((total - start) / pageSize)) }, (_, i) => {
      const from = start + i * pageSize;
      return [from, Math.min(from + pageSize - 1, total - 1)] as const;
    });
    const batch = await Promise.all(ranges.map(([from, to]) => fetchPage(from, to, false)));
    batch.forEach((page, index) => {
      const [from, to] = ranges[index];
      if (page.error || !page.data || page.data.length !== to - from + 1) {
        throw new Error("Study data is incomplete. Please retry.");
      }
      pages.push(page.data);
    });
  }
  const rows = pages.flat();
  if (rows.length !== total) throw new Error("Study data is incomplete. Please retry.");
  return rows;
}
