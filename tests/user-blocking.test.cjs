const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(reply = () => ({ response: { status: 204 } })) {
  const calls = [], exports = {};
  const file = path.resolve(__dirname, '../src/features/user-blocking/api.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  vm.runInNewContext(output, { exports, Error, require(name) {
    if (name === '@/i18n') return require('./helpers/i18n.cjs');
    if (name === '@/lib/api-response') return require('./helpers/api-response.cjs');
    assert.equal(name, '@/lib/authenticated-api');
    const send = method => async (url, body, signal) => {
      if (method === 'GET') { signal = body; body = undefined; }
      const call = { method, url, body, signal }; calls.push(call); return reply(call);
    };
    return { authenticatedGet: send('GET'), authenticatedPost: send('POST'), authenticatedDelete: send('DELETE') };
  } });
  return { api: exports, calls };
}

test('block and unblock use authenticated mutations, target only a user ID, and preserve cancellation', async () => {
  const { api, calls } = setup();
  const signal = new AbortController().signal;
  for (const blocking of [true, false]) await api.changeUserBlock(4, blocking, signal);
  assert.deepEqual(calls.map(value => value.method), ['POST', 'DELETE']);
  assert.equal(calls[0].url, '/api/user/blocks');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { userId: 4 });
  assert.equal(calls[1].signal, signal);
});

test('malformed IDs and pages never send a request; failed writes are never treated as successful', async () => {
  const { api, calls } = setup();
  for (const id of [0, -1, NaN, true, '2', 2.5]) await assert.rejects(api.changeUserBlock(id, true));
  for (const page of [0, -1, 1.5]) await assert.rejects(api.fetchBlockedUsers(page));
  assert.equal(calls.length, 0);
  for (const status of [200, 400, 403, 404, 500]) {
    await assert.rejects(setup(() => ({ response: { status } })).api.changeUserBlock(2, true));
  }
  const authError = new Error('requires authentication');
  await assert.rejects(setup(() => { throw authError; }).api.changeUserBlock(2, true), error => error === authError);
});

test('blocked-user pages validate identities, deduplicate and never follow a supplied external URL', async () => {
  const item = { id: 3, name: '사용자', identifyCode: 'ABC123' };
  const response = results => ({ response: { status: 200, ok: true }, payload: { data: {
    count: 5, results, next: 'https://untrusted.invalid/steal',
  } } });
  const { api, calls } = setup(() => response([item]));
  const page = await api.fetchBlockedUsers(1);
  assert.equal(page.nextPage, 2);
  await api.fetchBlockedUsers(page.nextPage);
  assert.equal(calls[1].url, '/api/user/blocks?page=2');
  for (const results of [[item, item], [{ ...item, id: '3' }], [{ ...item, identifyCode: null }]]) {
    await assert.rejects(setup(() => response(results)).api.fetchBlockedUsers());
  }
});
