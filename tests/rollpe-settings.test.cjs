const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = '12345678-1234-4234-8234-123456789abc';
const instant = Date.parse('2026-10-27T09:00:00+09:00');
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
}
const paper = () => ({ code, host: { id: 1 }, viewStat: false,
  receive: { receiver: { id: 2 }, receivingDate: '2026-10-29', receivingStat: 0 } });
const values = () => ({ isPrivate: true, password: '', receivingDate: '2026-10-30' });

function setup(reply = ({ body }) => ({ response: { status: 200, ok: true },
  payload: { data: { code: body.pcode, viewStat: body.viewStat, receivingDate: body.receivingDate } } })) {
  const calls = [], cache = new Map();
  class AuthenticationRequiredError extends Error {}
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const filename = path.resolve(__dirname, '../src', `${file}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Date: TestDate, Error, URL, URLSearchParams, Set, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/lib/authenticated-api') return { AuthenticationRequiredError,
        authenticatedPatch: async (url, body, signal) => { const call = { url, body, signal }; calls.push(call); return reply(call); } };
      return load(name.slice(2));
    } }, { filename });
    return exports;
  }
  return { ...load('features/rollpe-info/settings'), calls, AuthenticationRequiredError };
}

test('settings use the existing authenticated paper route and preserve the private password when blank', async () => {
  const state = setup(), signal = new AbortController().signal;
  await state.updateRollpeSettings(paper(), 1, values(), signal);
  assert.equal(state.calls[0].url, '/api/paper');
  assert.equal(state.calls[0].signal, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(state.calls[0].body)), { pcode: code, viewStat: false, receivingDate: '2026-10-30' });
  await state.updateRollpeSettings({ ...paper(), viewStat: true }, 1, { ...values(), password: 'local-paper-key' });
  assert.equal(state.calls[1].body.password, 'local-paper-key');
  await state.updateRollpeSettings(paper(), 1, { ...values(), isPrivate: false, password: 'discarded-local-value' });
  assert.equal(state.calls[2].body.viewStat, true);
  assert.equal(state.calls[2].body.password, undefined);
});

test('settings validate privacy transitions, password limits and unchanged settings before requesting', async () => {
  const state = setup();
  for (const [source, draft] of [[{ ...paper(), viewStat: true }, values()], [paper(), { ...values(), password: ' ' }],
    [paper(), { ...values(), password: 'x'.repeat(51) }], [paper(), { ...values(), receivingDate: paper().receive.receivingDate }]]) {
    await assert.rejects(state.updateRollpeSettings(source, 1, draft));
  }
  assert.equal(state.calls.length, 0);
});

test('Korea date limits include tomorrow and day thirty but allow an unchanged current delivery date', () => {
  const state = setup();
  const now = new Date('2026-10-27T16:00:00Z'); // Already October 28 in Korea.
  assert.deepEqual(JSON.parse(JSON.stringify(state.settingsDateLimits(now))), { minimum: '2026-10-29', maximum: '2026-11-27' });
  const source = { ...paper(), receive: { ...paper().receive, receivingDate: '2026-10-28' } };
  for (const day of ['2026-10-28', '2026-10-29', '2026-11-27']) {
    assert.equal(state.rollpeSettingsError(source, { ...values(), receivingDate: day }, now), null);
  }
  for (const day of ['bad', '2026-02-30', '2026-10-27', '2026-11-28']) {
    assert.ok(state.rollpeSettingsError(source, { ...values(), receivingDate: day }, now));
  }
});

test('nonhosts, scheduled delivery and early delivery cannot submit settings', async () => {
  const state = setup();
  await assert.rejects(state.updateRollpeSettings(paper(), 2, values()));
  for (const receive of [{ ...paper().receive, receivingStat: 1 }, { ...paper().receive, receivingDate: '2026-10-26' }]) {
    await assert.rejects(state.updateRollpeSettings({ ...paper(), receive }, 1, values()));
  }
  assert.equal(state.calls.length, 0);
});

test('uncertain or mismatched saves require authoritative reload and never automatically replay', async () => {
  for (const reply of [() => { throw new Error('offline'); }, () => ({ response: { status: 503 }, payload: null }),
    () => ({ response: { status: 200 }, payload: { data: { code, viewStat: true, receivingDate: values().receivingDate } } }),
    () => ({ response: { status: 200 }, payload: { data: {} } })]) {
    const state = setup(reply);
    await assert.rejects(state.updateRollpeSettings(paper(), 1, values()), error => error.reason === 'reload');
    assert.equal(state.calls.length, 1);
  }
  for (const [status, reason] of [[403, 'reload'], [483, 'reload'], [404, 'missing'], [400, undefined]]) {
    await assert.rejects(setup(() => ({ response: { status }, payload: null })).updateRollpeSettings(paper(), 1, values()), error => error.reason === reason);
  }
});

test('authentication failures and caller cancellation preserve their identity', async () => {
  let cause;
  const state = setup(() => { throw cause; });
  cause = new state.AuthenticationRequiredError();
  await assert.rejects(state.updateRollpeSettings(paper(), 1, values()), error => error === cause);
  const controller = new AbortController(); controller.abort(); cause = new Error('cancelled');
  await assert.rejects(state.updateRollpeSettings(paper(), 1, values(), controller.signal), error => error === cause);
});
