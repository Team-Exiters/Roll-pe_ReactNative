export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export type ApiPage<T> = { count: number; items: T[]; nextPage: number | null };

type PaginatedData = { count: number; results: unknown[]; next: string | null };

function isPaginatedData(value: unknown): value is PaginatedData {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.count) &&
    Array.isArray(value.results) &&
    value.count >= value.results.length &&
    (value.next === null || (typeof value.next === 'string' && value.next.length > 0)) &&
    (value.next === null || value.results.length > 0)
  );
}

export function parsePage<T>(
  data: unknown,
  page: number,
  parseItem: (value: unknown) => T,
  uniqueKeys: readonly ((item: T) => string | number)[],
  errorMessage: string,
): ApiPage<T> {
  if (!isPositiveInteger(page) || !isPaginatedData(data)) throw new Error(errorMessage);

  const items = data.results.map(parseItem);
  if (uniqueKeys.some((key) => new Set(items.map(key)).size !== items.length)) {
    throw new Error(errorMessage);
  }

  // Treat next as a flag only. Never forward credentials to a server-supplied URL.
  return { count: data.count, items, nextPage: data.next === null ? null : page + 1 };
}
