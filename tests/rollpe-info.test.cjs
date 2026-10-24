const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
const user = (id = 1) => ({ id, name: '사용자', identifyCode: 'User12' });
const message = { id: 7, code: 'abcdefab-abcd-4abc-8abc-abcdefabcdef', index: 2, author: user(3), content: '축하해요!', color: 'FFB9B9' };
const paper = () => ({ id: 9, code, title: '생일 축하해요', host: user(), receive: { receiver: user(2), receivingDate: '2026-10-25', receivingStat: 0 },
  viewStat: false, ratio: '가로', theme: '화이트', size: 'A4', maxHeartLength: 12, hearts: { count: 1, data: [message] } });
function setup(reply = () => ({ response: { status: 200, ok: true }, payload: { data: paper() } })) {
  const cache = new Map(), calls = [];
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const filename = path.resolve(__dirname, '../src', name === 'link' ? 'utils/rollpe-link.ts' : `features/rollpe-info/${name}.ts`);
    const exports = {};
    cache.set(name, exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, Date, Error, URL, URLSearchParams, Set, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/utils/rollpe-link') return load('link');
      if (name === '@/features/rollpe-info/model') return load('model');
      assert.equal(name, '@/lib/authenticated-api');
      return { authenticatedGet: async (url, signal) => { const call = { method: 'GET', url, signal }; calls.push(call); return reply(call); },
        authenticatedPost: async (url, body, signal) => { const call = { method: 'POST', url, body, signal }; calls.push(call); return reply(call); } };
    } }, { filename });
    return exports;
  }
  return { api: load('api'), model: load('model'), link: load('link'), calls };
}

test('detail uses the original authenticated endpoint, normalizes UUIDs and memo colors, and forwards cancellation', async () => {
  const { api, calls } = setup();
  const signal = new AbortController().signal;
  const data = await api.fetchRollpeInfo(code.replaceAll('-', '').toUpperCase(), signal);
  assert.equal(calls[0].url, `/api/paper?pcode=${code}`);
  assert.equal(calls[0].signal, signal);
  assert.equal(data.hearts.data[0].color, '#FFB9B9');
  assert.equal(data.hearts.data[0].content, message.content);
  assert.equal(data.hearts.data[0].index, 2);
  assert.equal(calls.length, 1); // Reading never joins implicitly or asks an invited user for a password.
});

test('entry is offered only for the explicit membership response; errors and malformed replies never display a paper', async () => {
  for (const status of [471, 404, 403, 410, 503]) {
    const { api, calls } = setup(() => ({ response: { status, ok: false }, payload: null }));
    await assert.rejects(api.fetchRollpeInfo(code), error => status === 471 ? error.reason === 'join' : error.reason !== 'join');
    assert.equal(calls.length, 1);
  }
  for (const data of [null, { ...paper(), code: message.code }, { ...paper(), receive: { ...paper().receive, receivingDate: '2026-02-30' } },
    { ...paper(), hearts: { count: 1 } }, { ...paper(), hearts: { count: 2, data: [message, { ...message, id: 8 }] } },
    { ...paper(), hearts: { count: 1, data: [{ ...message, index: 12 }] } },
    { ...paper(), hearts: { count: 1, data: [{ ...message, color: 'url(unsafe)' }] } }]) {
    await assert.rejects(setup(() => ({ response: { status: 200, ok: true }, payload: { data } })).api.fetchRollpeInfo(code));
  }
  const empty = { ...paper(), hearts: { count: 0 }, receive: { ...paper().receive, receiver: null } };
  assert.equal((await setup(() => ({ response: { status: 200, ok: true }, payload: { data: empty } })).api.fetchRollpeInfo(code)).hearts.data.length, 0);
});

test('all six original A4 themes are accepted and unsupported layouts fail explicitly', async () => {
  for (const ratio of ['가로', '세로']) for (const theme of ['화이트', '축하', '추모']) {
    const data = await setup(() => ({ response: { status: 200, ok: true }, payload: { data: { ...paper(), ratio, theme } } })).api.fetchRollpeInfo(code);
    assert.equal(data.theme, theme);
    assert.equal(data.ratio, ratio);
  }
  for (const change of [{ size: 'A3' }, { ratio: 'unknown' }, { theme: 'unknown' }, { maxHeartLength: 20 }]) {
    await assert.rejects(setup(() => ({ response: { status: 200, ok: true }, payload: { data: { ...paper(), ...change } } })).api.fetchRollpeInfo(code));
  }
});

test('join sends only code and the supplied password; concurrent membership is handled by re-reading', async () => {
  for (const status of [204, 473]) {
    const { api, calls } = setup(() => ({ response: { status, ok: status === 204 }, payload: null }));
    await api.enterRollpe(code, 'test-only-paper-password');
    assert.equal(calls[0].url, '/api/paper/enter');
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { pcode: code.replaceAll('-', ''), password: 'test-only-paper-password' });
  }
  const { api, calls } = setup(() => ({ response: { status: 204, ok: true }, payload: null }));
  await api.enterRollpe(code);
  assert.equal(Object.hasOwn(calls[0].body, 'password'), false);
  for (const status of [400, 472]) await assert.rejects(setup(() => ({ response: { status }, payload: null })).api.enterRollpe(code), error => error.reason === 'password');
});

test('invalid codes and unsafe return destinations are rejected before any API call', async () => {
  const { api, link, calls } = setup();
  for (const value of ['', undefined, [code], code + '?admin=true', '../paper', 'https://example.com']) {
    assert.equal(link.normalizeRollpeCode(value), null);
    await assert.rejects(api.fetchRollpeInfo(value));
    await assert.rejects(api.enterRollpe(value));
  }
  assert.equal(calls.length, 0);
  assert.equal(link.rollpeDestination(`/rollpe/${code}`), `/rollpe/${code}`);
  for (const value of [`/rollpe/${code}?next=https://evil.example`, '/home', `https://example.com/rollpe/${code}`, [`/rollpe/${code}`]]) {
    assert.equal(link.rollpeDestination(value), null);
  }
});

test('the deadline is exactly ten AM Korea time and only the receiver retains the completed paper view', () => {
  const { model } = setup();
  const deadline = Date.parse('2026-10-25T01:00:00Z');
  assert.equal(model.rollpeDeadline('2026-10-25'), deadline);
  assert.equal(model.rollpeRole(paper(), 1, deadline - 1), 'host');
  assert.equal(model.rollpeRole(paper(), 3, deadline - 1), 'participant');
  assert.equal(model.rollpeRole(paper(), 1, deadline), 'unavailable');
  assert.equal(model.rollpeRole(paper(), 2, deadline), 'receiver');
  assert.equal(model.remainingTime('2026-10-25', deadline - 86_400_000 - 3_660_000), '종료까지: 1일 1시간 1분 남음');
  assert.equal(model.remainingTime('2026-10-25', deadline - 1000), '종료까지: 0분 남음');
  assert.equal(model.remainingTime('2026-10-25', deadline), '이미 종료된 롤페입니다.');
});

test('shared links use an explicit website or the app scheme and reporting encodes user-supplied identifiers', () => {
  const { model } = setup();
  assert.equal(model.rollpeShareUrl(code), `rollpe://rollpe/${code}`);
  assert.equal(model.rollpeShareUrl(code, 'https://web.example'), `https://web.example/rollpe/${code}`);
  for (const website of ['http://web.example', 'https://user:password@web.example', 'https://web.example/other', 'https://localhost', 'https://web.example?x=1']) {
    assert.equal(model.rollpeShareUrl(code, website), `rollpe://rollpe/${code}`);
  }
  const url = new URL(model.reportRollpeUrl(code, 'User&code=7'));
  assert.equal(url.searchParams.get('entry.2107714088'), 'User&code=7');
  assert.equal(url.searchParams.get('entry.1553361014'), code);
});
