const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
const paper = () => ({ id: 1, code, title: '내 롤페', theme: '화이트', viewStat: false,
  host: { id: 1, name: '방장' }, receive: { receiver: { id: 2 }, receivingDate: '2099-10-27', receivingStat: 0 }, createdAt: '2026-10-26T09:00:00+09:00' });
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
  return { ...load('features/my-page/api'), calls, AuthenticationRequiredError };
}

test('each personal menu uses its authenticated API kind and only projects summary fields', async () => {
  const state = setup(() => page([{ ...paper(), hearts: { data: ['must not propagate'] }, invitingUser: ['private member'] }]));
  const signal = new AbortController().signal;
  for (const [kind, type] of [['created', 'host'], ['participating', 'participating'], ['received', 'my']]) {
    const result = await state.fetchMyRollpes(kind, 1, signal);
    const request = state.calls.at(-1);
    assert.equal(request.url, `/api/paper/mypage?type=${type}&page=1`);
    assert.equal(request.signal, signal);
    assert.equal(result.items[0].isPublic, false);
    assert.equal(result.items[0].receiverId, 2);
    assert.equal(result.items[0].hearts, undefined);
    assert.equal(result.items[0].invitingUser, undefined);
  }
});

test('legacy empty first pages and paginated empties are valid while errors stay errors', async () => {
  for (const data of [[], { count: 0, results: [], next: null }]) {
    const result = await setup(() => ({ response: { ok: true }, payload: { data } })).fetchMyRollpes('created');
    assert.equal(result.count, 0);
    assert.equal(result.items.length, 0);
    assert.equal(result.nextPage, null);
  }
  for (const reply of [() => ({ response: { ok: false, status: 404 } }), () => { throw new Error('offline'); },
    () => ({ response: { ok: true }, payload: { data: { count: 1, results: [], next: 'more' } } })]) {
    await assert.rejects(setup(reply).fetchMyRollpes('created'));
  }
  await assert.rejects(setup(() => ({ response: { ok: true }, payload: { data: [] } })).fetchMyRollpes('created', 2));
});

test('invalid identities, dates, visibility and duplicate summaries are rejected', async () => {
  for (const change of [{ id: 0 }, { code: 'bad' }, { title: '' }, { viewStat: undefined }, { host: { name: 'missing id' } },
    { theme: 'unknown' }, { createdAt: 'invalid' }, { receive: { ...paper().receive, receiver: {} } },
    { receive: { ...paper().receive, receivingStat: 2 } }, { receive: { ...paper().receive, receivingDate: '2026-02-30' } }]) {
    await assert.rejects(setup(() => page([{ ...paper(), ...change }])).fetchMyRollpes('created'));
  }
  await assert.rejects(setup(() => page([paper(), paper()])).fetchMyRollpes('created'));
  assert.equal((await setup(() => page([{ ...paper(), receive: { ...paper().receive, receiver: null } }])).fetchMyRollpes('created')).items[0].receiverId, null);
});

test('more pages never follow URLs from the response', async () => {
  const state = setup(() => ({ ...page(), payload: { data: { count: 21, results: [paper()], next: 'https://untrusted.example/collect' } } }));
  const result = await state.fetchMyRollpes('created');
  await state.fetchMyRollpes('created', result.nextPage);
  assert.equal(state.calls[1].url, '/api/paper/mypage?type=host&page=2');
});

test('invalid kinds and pages never make a request; auth and cancellation remain recognizable', async () => {
  const state = setup();
  for (const kind of ['unknown', '__proto__', null]) await assert.rejects(state.fetchMyRollpes(kind));
  for (const pageNumber of [0, -1, 1.5]) await assert.rejects(state.fetchMyRollpes('created', pageNumber));
  assert.equal(state.calls.length, 0);
  let cause;
  const broken = setup(() => { throw cause; });
  cause = new broken.AuthenticationRequiredError();
  await assert.rejects(broken.fetchMyRollpes('participating'), error => error === cause);
  const controller = new AbortController(); controller.abort(); cause = new Error('aborted');
  await assert.rejects(broken.fetchMyRollpes('received', 1, controller.signal), error => error === cause);
});

test('completed papers keep their history but only the receiver can open them after the exact Korea deadline', async () => {
  const state = setup(() => page([{ ...paper(), receive: { ...paper().receive, receivingDate: '2026-10-26' } }]));
  const item = (await state.fetchMyRollpes('created')).items[0];
  const before = Date.parse('2026-10-26T09:59:59+09:00'), deadline = Date.parse('2026-10-26T10:00:00+09:00');
  assert.equal(state.canOpenMyRollpe(item, 1, before), true);
  assert.equal(state.isMyRollpeDelivered(item, before), false);
  assert.equal(state.canOpenMyRollpe(item, 1, deadline), false);
  assert.equal(state.canOpenMyRollpe(item, 2, deadline), true);
  assert.equal(state.isMyRollpeDelivered(item, deadline), true);
  assert.equal(state.canOpenMyRollpe({ ...item, receivingStat: 1 }, 1, before), false);
});

