const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';

function setup(reply = () => ({ response: { status: 201 }, payload: { data: { alreadyReported: false } } })) {
  const calls = [], modules = new Map();
  class AuthenticationRequiredError extends Error {}
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {}; modules.set(file, exports);
    const filename = path.resolve(__dirname, '../src', file);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    } }).outputText, { exports, Error, require(name) {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/lib/api-response') return require('./helpers/api-response.cjs');
      if (name === '@/utils/rollpe-link') return load('utils/rollpe-link.ts');
      assert.equal(name, '@/lib/authenticated-api');
      return { AuthenticationRequiredError, authenticatedPost: async (url, body, signal) => {
        const call = { url, body, signal }; calls.push(call); return reply(call);
      } };
    } });
    return exports;
  }
  return { api: load('features/content-report/api.ts'), calls, AuthenticationRequiredError };
}

test('reports use the authenticated API for both targets and never send user identity or client evidence', async () => {
  for (const type of ['paper', 'heart']) {
    const { api, calls } = setup();
    const signal = new AbortController().signal;
    const message = await api.submitContentReport({ type, code: code.replaceAll('-', '').toUpperCase() }, 'abuse', ' 확인해주세요. ', signal);
    assert.match(message, /접수/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/user/reports');
    assert.equal(calls[0].signal, signal);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { targetType: type, targetCode: code, reason: 'abuse', description: '확인해주세요.' });
  }
});

test('invalid UUIDs, unsupported targets, reasons and oversized details never send a request', async () => {
  const { api, calls } = setup();
  const target = { type: 'heart', code };
  for (const bad of [{ ...target, code: 'bad' }, { ...target, type: 'user' }]) {
    await assert.rejects(api.submitContentReport(bad, 'spam', ''));
  }
  await assert.rejects(api.submitContentReport(target, 'made-up', ''));
  await assert.rejects(api.submitContentReport(target, 'other', '가'.repeat(501)));
  assert.equal(calls.length, 0);
});

test('only validated first and duplicate receipts are successes; failures never trigger an automatic resubmit', async () => {
  const target = { type: 'heart', code };
  const duplicate = setup(() => ({ response: { status: 200 }, payload: { data: { alreadyReported: true } } }));
  assert.match(await duplicate.api.submitContentReport(target, 'spam', ''), /이미/);
  for (const reply of [
    () => ({ response: { status: 201 }, payload: null }),
    () => ({ response: { status: 201 }, payload: { data: { alreadyReported: true } } }),
    () => ({ response: { status: 200 }, payload: { data: { alreadyReported: false } } }),
    ...[400, 403, 404, 429, 500].map(status => () => ({ response: { status } })),
    () => { throw new Error('offline'); },
  ]) {
    const env = setup(reply);
    await assert.rejects(env.api.submitContentReport(target, 'spam', ''));
    assert.equal(env.calls.length, 1);
  }
});

test('authentication failures and aborted requests stay distinguishable from report errors', async () => {
  const env = setup(() => { throw new env.AuthenticationRequiredError(); });
  await assert.rejects(env.api.submitContentReport({ type: 'heart', code }, 'spam', ''), error => error instanceof env.AuthenticationRequiredError);
  const controller = new AbortController(); controller.abort();
  const abort = new Error('aborted');
  await assert.rejects(setup(() => { throw abort; }).api.submitContentReport({ type: 'heart', code }, 'spam', '', controller.signal), error => error === abort);
});
