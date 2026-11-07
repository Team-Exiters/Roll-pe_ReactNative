const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function setup(reply) {
  const calls = [];
  class AuthenticationRequiredError extends Error {}
  function load(relative) {
    const exports = {};
    const source = ts.transpileModule(
      fs.readFileSync(path.resolve(__dirname, '../src', relative), 'utf8'),
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      },
    ).outputText;
    vm.runInNewContext(source, {
      exports,
      Error,
      URL,
      require(name) {
        if (name === '@/i18n') return require('./helpers/i18n.cjs');
        if (name === '@/lib/api-response') return require('./helpers/api-response.cjs');
        if (name === '@/utils/rollpe-link') return load('utils/rollpe-link.ts');
        const send = (method, url, body, signal) => {
          calls.push({ method, url, body, signal });
          return reply?.(calls.at(-1));
        };
        if (name === '@/lib/authenticated-api')
          return {
            AuthenticationRequiredError,
            authenticatedPost: (...args) => send('POST', ...args),
          };
        if (name === '@/lib/api')
          return {
            apiUrl: 'https://api.example.test',
            requestJson: (url, body, method, signal) => send(method, url, body, signal),
          };
        throw new Error('Unexpected import: ' + name);
      },
    });
    return exports;
  }
  return {
    api: load('features/support/api.ts'),
    html: load('features/support/html-document.ts'),
    calls,
    AuthenticationRequiredError,
  };
}

const draft = { category: 'bug', content: ' 확인 부탁드립니다. ' };
const id = '12345678-1234-4234-8234-123456789abc';

test('inquiries preserve their retry identity, validate form fields and accept only confirmed receipts', async () => {
  const env = setup(() => ({ response: { status: 201 }, payload: { data: { received: true } } }));
  const signal = new AbortController().signal;
  await env.api.sendInquiry(draft, id, signal);
  assert.equal(env.calls[0].url, '/api/engine/inquiries');
  assert.equal(Object.hasOwn(env.calls[0].body, 'email'), false);
  assert.equal(env.calls[0].body.content, '확인 부탁드립니다.');
  assert.equal(env.calls[0].body.requestId, id);
  assert.equal(env.calls[0].signal, signal);
  for (const changes of [{ category: null }, { content: ' ' }, { content: '가'.repeat(2001) }]) {
    await assert.rejects(env.api.sendInquiry({ ...draft, ...changes }, id));
  }
  assert.equal(env.calls.length, 1);
  for (const response of [
    { response: { status: 201 }, payload: null },
    { response: { status: 200 }, payload: { data: { received: false } } },
    ...[400, 429, 500].map((status) => ({ response: { status } })),
  ])
    await assert.rejects(setup(() => response).api.sendInquiry(draft, id));
});

test('inquiries never silently retry an uncertain submission and preserve authentication errors', async () => {
  const env = setup(() => {
    throw new Error('offline');
  });
  await assert.rejects(env.api.sendInquiry(draft, id));
  assert.equal(env.calls.length, 1);
  const auth = setup(() => {
    throw new auth.AuthenticationRequiredError();
  });
  await assert.rejects(
    auth.api.sendInquiry(draft, id),
    (error) => error instanceof auth.AuthenticationRequiredError,
  );
});

test('notice pagination uses local paths and rejects malformed or mismatched details', async () => {
  const item = { id: 3, title: '공지사항', publishedAt: '2026-11-07T00:00:00Z' };
  const env = setup(() => ({
    response: { ok: true },
    payload: {
      data: {
        count: 2,
        results: [item],
        next: 'https://untrusted.invalid/page',
      },
    },
  }));
  assert.equal((await env.api.fetchNotices()).nextPage, 2);
  await env.api.fetchNotices(2);
  assert.equal(env.calls[1].url, '/api/engine/notices?page=2');
  const detail = setup(() => ({
    response: { ok: true },
    payload: { data: { ...item, body: '<p>안내</p>' } },
  }));
  assert.equal((await detail.api.fetchNotice(3)).body, '<p>안내</p>');
  await assert.rejects(detail.api.fetchNotice(4));
  for (const value of [0, -1, NaN, 1.5]) await assert.rejects(detail.api.fetchNotice(value));
});

test('notice documents disable active content and links accept only HTTPS and email destinations', () => {
  const { html } = setup();
  const document = html.noticeDocument('<p>안내</p>');
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /font-family: -apple-system/);
  assert.doesNotMatch(document, /@font-face|data:font|font-src/);
  for (const url of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'rollpe://auth/apple',
    'https://user:password@example.com',
    '/relative',
  ]) {
    assert.equal(html.noticeLink(url), null);
  }
  assert.equal(html.noticeLink('https://example.com/help'), 'https://example.com/help');
  assert.equal(html.noticeLink('mailto:help@example.com'), 'mailto:help@example.com');
});
