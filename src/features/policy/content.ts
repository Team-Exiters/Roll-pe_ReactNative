import { requestJson } from '../../lib/api';

export type PolicyType = 'terms' | 'privacy';
export type PolicyBlock = { kind: 'p' | 'h2' | 'h3' | 'li'; text: string };

const blockMargin = { p: 20, h2: 24.9, h3: 23.4, li: 20 };

// Browser block margins collapse; React Native margins otherwise add together.
export function policySpacing(blocks: PolicyBlock[], index: number) {
  const current = blocks[index];
  const previous = blocks[index - 1];
  const sameList = current.kind === 'li' && previous?.kind === 'li';
  return {
    marginTop: sameList ? 0 : Math.max(blockMargin[current.kind], previous ? blockMargin[previous.kind] : 0),
    marginBottom: index === blocks.length - 1 ? blockMargin[current.kind] : 0,
  };
}

export function policyType(value: unknown): PolicyType | null {
  return value === 'terms' || value === 'privacy' ? value : null;
}

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? original;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : '\ufffd';
  });
}

// Only text is rendered. Remote markup is never passed to an HTML engine.
export function policyBlocks(html: string): PolicyBlock[] {
  const safe = html.replace(/<!--[^]*?(?:-->|$)/g, '')
    .replace(/<(script|style|iframe|object|template|svg|math)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|template|svg|math)\b[^>]*>[^]*$/gi, '');
  const blocks: PolicyBlock[] = [];
  let kind: PolicyBlock['kind'] = 'p';
  let text = '';
  const flush = () => {
    const value = decodeEntities(text.replace(/\s+/g, ' ').replace(/\u0000/g, '\n')).trim();
    if (value) blocks.push({ kind, text: value });
    text = '';
  };
  for (const token of safe.match(/<[^>]*>|[^<]+|</g) ?? []) {
    if (!token.startsWith('<')) { text += token; continue; }
    const tag = /^<\s*(\/?)\s*([a-z0-9]+)/i.exec(token);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (['p', 'h2', 'h3', 'li'].includes(name)) {
      flush();
      kind = tag[1] ? 'p' : name as PolicyBlock['kind'];
    } else if (name === 'br') text += '\u0000';
    else if (['ul', 'ol', 'div'].includes(name)) flush();
  }
  flush();
  return blocks;
}

export function policyEndpoint(base: string | undefined, type: PolicyType): string {
  if (!policyType(type)) throw new Error('잘못된 입력값입니다.');
  try {
    const url = new URL(base ?? '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
        || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error();
    return `${url.origin}/api/user/docs?docs=${type}`;
  } catch { throw new Error('서버 주소를 확인해주세요.'); }
}

export async function fetchPolicy(type: PolicyType, signal: AbortSignal): Promise<PolicyBlock[]> {
  const endpoint = policyEndpoint(process.env.EXPO_PUBLIC_API_URL, type);
  const { response, payload } = await requestJson(endpoint, undefined, 'GET', signal);
  if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload) || typeof payload.data !== 'string') {
    throw new Error('오류가 발생하였습니다.');
  }
  const blocks = policyBlocks(payload.data);
  if (!blocks.length) throw new Error('오류가 발생하였습니다.');
  return blocks;
}
