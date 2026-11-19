export class PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;

  static of<T>(
    content: T[],
    totalElements: number,
    page: number,
    size: number,
  ): PageResponse<T> {
    const safeSize = size > 0 ? size : 20;
    const totalPages = Math.ceil(totalElements / safeSize);
    const res = new PageResponse<T>();
    res.content = content;
    res.page = page;
    res.size = safeSize;
    res.totalElements = Number(totalElements);
    res.totalPages = totalPages;
    res.last = page >= totalPages - 1 || totalPages === 0;
    return res;
  }
}
