const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
const paper = () => ({ id: 1, code, title: '생일 축하', theme: '화이트', viewStat: true,
  host: { name: '방장' }, receive: { receivingDate: '2099-10-27', receivingStat: 0 }, createdAt: '2026-10-26T09:00:00+09:00' });
const page = (results = [paper()]) => ({ response: { ok: true, status: 200 }, payload: { data: { count: results.length, results, next: null } } });
function setup(reply = () => page()) {
  const calls = [], cache = new Map();
  class AuthenticationRequiredError extends Error {}
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const filename = path.resolve(__dirname, '../src', `${file}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Date, Error, URLSearchParams, Set, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/lib/authenticated-api') return { AuthenticationRequiredError,
        authenticatedGet: async (url, signal) => { calls.push({ url, signal }); return reply({ url, signal }); } };
      return load(name.slice(2));
    } }, { filename });
    return exports;
  }
  return { ...load('features/search/api'), calls, AuthenticationRequiredError };
}

test('title search trims and encodes Korean and reserved characters, using the authenticated API and cancellation', async () => {
  const { searchRollpes, calls } = setup();
  const signal = new AbortController().signal;
  const result = await searchRollpes('  생일 & 축하?  ', 1, signal);
  const query = new URL(calls[0].url, 'https://local.test');
  assert.equal(query.pathname, '/api/engine/search');
  assert.equal(query.searchParams.get('k'), '생일 & 축하?');
  assert.equal(query.searchParams.get('page'), '1');
  assert.equal(calls[0].signal, signal);
  assert.equal(result.items[0].receivingDate, '2099-10-27');
});

test('successful empty pages remain distinct from network, HTTP and malformed response failures', async () => {
  assert.equal((await setup(() => page([])).searchRollpes('없는 제목')).items.length, 0);
  for (const reply of [() => ({ response: { status: 404 }, payload: null }), () => ({ response: { status: 500 }, payload: null }),
    () => { throw new Error('transport failure'); }, () => ({ response: { ok: true }, payload: { data: { count: 0, results: [], next: 'more' } } })]) {
    const { searchRollpes } = setup(reply);
    await assert.rejects(searchRollpes('생일'), { message: '검색 결과를 불러오지 못했습니다. 다시 시도해주세요.' });
  }
});

test('private, already delivered, malformed and duplicate items never appear as search results', async () => {
  for (const change of [{ viewStat: false }, { viewStat: undefined }, { receive: { ...paper().receive, receivingStat: 1 } },
    { code: 'bad-code' }, { createdAt: 'invalid date' }, { receive: { ...paper().receive, receivingDate: '2026-02-30' } }, { theme: 'unknown' }]) {
    await assert.rejects(setup(() => page([{ ...paper(), ...change }])).searchRollpes('생일'));
  }
  await assert.rejects(setup(() => page([paper(), paper()])).searchRollpes('생일'));
});

test('pagination reconstructs local API paths and never forwards credentials to supplied next URLs', async () => {
  const state = setup(() => ({ ...page(), payload: { data: { count: 25, results: [paper()], next: 'https://untrusted.example/collect' } } }));
  const result = await state.searchRollpes('생일');
  assert.equal(result.nextPage, 2);
  await state.searchRollpes('생일', result.nextPage);
  assert.equal(state.calls[1].url, '/api/engine/search?k=%EC%83%9D%EC%9D%BC&page=2');
});

test('invalid inputs never send a search request and authentication and explicit aborts remain distinguishable', async () => {
  const { searchRollpes, calls } = setup();
  for (const [keyword, number] of [[''], ['  '], ['x'.repeat(101)], ['생일', 0], ['생일', 1.5]]) await assert.rejects(searchRollpes(keyword, number));
  assert.equal(calls.length, 0);
  let cause;
  const state = setup(() => { throw cause; });
  cause = new state.AuthenticationRequiredError();
  await assert.rejects(state.searchRollpes('생일'), error => error === cause);
  const controller = new AbortController(); controller.abort(); cause = new Error('aborted');
  await assert.rejects(state.searchRollpes('생일', 1, controller.signal), error => error === cause);
});
