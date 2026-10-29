const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
function setup(reply) {
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
      if (name !== '@/lib/authenticated-api') return load(name.slice(2));
      return { AuthenticationRequiredError, ...Object.fromEntries(['Get', 'Post', 'Delete'].map(method => [
        `authenticated${method}`, async (url, body, signal) => {
          const call = method === 'Get' ? { method: 'GET', url, signal: body } : { method: method.toUpperCase(), url, body, signal };
          calls.push(call); return reply(call);
        },
      ])) };
    } }, { filename });
    return exports;
  }
  return { history: load('features/rollpe-content/revisions'), calls, AuthenticationRequiredError };
}
test('revision lists show newest first while preserving original numbers, content and timestamps', async () => {
  const revisions = [0, 1, 2].map(number => ({ number, content: `수정 ${number}`, color: 'FFB9B9', baseline: false, recordedAt: `2026-10-26T10:0${number}:00+09:00` }));
  for (const responseOrder of [[...revisions].reverse(), revisions]) {
    const { history, calls } = setup(() => ({ response: { ok: true }, payload: { data: { heartCode: code, revisions: responseOrder } } }));
    const signal = new AbortController().signal;
    const data = await history.fetchHeartRevisions(code, signal);
    assert.deepEqual(Array.from(data, item => item.number), [2, 1, 0]);
    assert.equal(data[0].content, revisions[2].content);
    assert.equal(data[0].color, '#FFB9B9');
    assert.equal(data[0].recordedAt, revisions[2].recordedAt);
    assert.equal(data[2].recordedAt, revisions[0].recordedAt);
    assert.equal(calls[0].url, `/api/heart/revisions?hcode=${code}`);
    assert.equal(calls[0].signal, signal);
  }
  assert.equal(revisions[0].number, 0);
});
test('unauthorized, mismatched, out of order and malformed history never renders as a valid list', async () => {
  const original = { number: 0, content: '원본', color: 'F2EB28', recordedAt: '2026-10-26T00:00:00Z', baseline: true };
  for (const data of [{ heartCode: 'bad', revisions: [original] }, { heartCode: code, revisions: [] },
    { heartCode: code, revisions: [original, { ...original, number: 2 }] },
    { heartCode: code, revisions: [{ ...original, color: 'unsafe' }] },
    { heartCode: code, revisions: [{ ...original, recordedAt: 'bad' }] }]) {
    await assert.rejects(setup(() => ({ response: { ok: true }, payload: { data } })).history.fetchHeartRevisions(code));
  }
  for (const status of [403, 404, 500]) {
    await assert.rejects(setup(() => ({ response: { ok: false, status } })).history.fetchHeartRevisions(code));
  }
});
