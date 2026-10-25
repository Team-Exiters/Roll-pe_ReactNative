const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const rollpe = { id: 1, code: 'paper-code', title: '축하해요', theme: '축하',
  host: { name: '작성자' }, receive: { receivingDate: '2026-12-25' } };
function homeService(respond) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '../src/features/home/api.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, Date, Error, require: name => {
        if (name === '@/i18n') return require('./helpers/i18n.cjs');
    assert.equal(name, '@/lib/authenticated-api');
    return { authenticatedGet: respond };
  } });
  return exports;
}

test('home uses the original authenticated status/hot paths and forwards cancellation', async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const service = homeService(async (url, requestSignal) => {
    calls.push(url);
    assert.equal(requestSignal, signal);
    return { response: { ok: true, status: 200 }, payload: { data: url.includes('mypage') ? { host: 3, heart: 8 } : [rollpe] } };
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await service.fetchHomeStatus(signal))), { host: 3, heart: 8 });
  assert.deepEqual(JSON.parse(JSON.stringify(await service.fetchHotRollpes(signal))), [rollpe]);
  assert.deepEqual(calls, ['/api/paper/mypage?type=main', '/api/paper/user?type=hot']);
});

test('home rejects malformed counts, cards, dates and HTTP errors while accepting an empty list', async () => {
  const signal = new AbortController().signal;
  const service = (data, ok = true) => homeService(async () => ({ response: { ok, status: ok ? 200 : 503 }, payload: { data } }));
  for (const data of [null, [], { host: -1, heart: 0 }, { host: '3', heart: 1 }, { host: 0, heart: 0.5 }]) {
    await assert.rejects(service(data).fetchHomeStatus(signal));
  }
  for (const data of [null, {}, [null], [{ ...rollpe, host: null }], [{ ...rollpe, receive: { receivingDate: '2026-02-30' } }],
    [{ ...rollpe, receive: { ...rollpe.receive, receivingStat: '1' } }]]) {
    await assert.rejects(service(data).fetchHotRollpes(signal));
  }
  await assert.rejects(service([rollpe], false).fetchHotRollpes(signal));
  assert.equal((await service([]).fetchHotRollpes(signal)).length, 0);
  assert.equal((await service([{ ...rollpe, receive: { ...rollpe.receive, receivingStat: 1 } }]).fetchHotRollpes(signal))[0].receive.receivingStat, 1);
});

test('home propagates authentication and cancellation errors without hiding them as malformed data', async () => {
  for (const error of [new Error('authentication required'), new Error('cancelled')]) {
    const service = homeService(async () => { throw error; });
    await assert.rejects(service.fetchHomeStatus(new AbortController().signal), actual => actual === error);
    await assert.rejects(service.fetchHotRollpes(new AbortController().signal), actual => actual === error);
  }
});

test('D-day matches the original complete-day count to local receiving-date midnight', () => {
  const { dDay } = homeService();
  assert.equal(dDay('2026-10-22', new Date(2026, 9, 22, 12)), 'D-Day');
  assert.equal(dDay('2026-10-23', new Date(2026, 9, 22, 12)), 'D-Day');
  assert.equal(dDay('2026-10-24', new Date(2026, 9, 22, 12)), 'D-1');
  assert.equal(dDay('2026-10-23', new Date(2026, 9, 22)), 'D-1');
  assert.equal(dDay('2026-10-21', new Date(2026, 9, 22, 12)), '마감');
});
