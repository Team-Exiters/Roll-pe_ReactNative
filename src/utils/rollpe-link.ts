export function normalizeRollpeCode(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) return null;
  const compact = value.replace(/-/g, '').toLowerCase();
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function rollpeDestination(value: unknown): `/rollpe/${string}` | null {
  if (typeof value !== 'string') return null;
  const code = normalizeRollpeCode(/^\/rollpe\/([^/?#]+)$/.exec(value)?.[1]);
  return code ? `/rollpe/${code}` : null;
}
