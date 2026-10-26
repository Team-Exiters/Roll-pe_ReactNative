const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
const invitationCode = '22345678-1234-4234-8234-123456789abc';
const invitation = () => ({ invitationCode, code, title: '비공개 생일 초대', theme: '화이트', isPublic: false,
  host: { name: '방장' }, receivingDate: '2099-10-27', sentAt: '2026-10-26T09:00:00+09:00' });
const page = (results = [invitation()]) => ({ response: { ok: true, status: 200 }, payload: { data: { count: results.length, results, next: null } } });
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
        authenticatedGet: async (url, signal) => { calls.push({ method: 'GET', url, signal }); return reply({ url, signal }); },
        authenticatedPost: async (url, body, signal) => { calls.push({ method: 'POST', url, body, signal }); return reply({ url, body, signal }); } };
      return load(name.slice(2));
    } }, { filename });
    return exports;
  }
  return { ...load('features/invitations/api'), calls, AuthenticationRequiredError };
}

test('pending invitations include private summaries and project out unexpected content', async () => {
  const state = setup(() => page([{ ...invitation(), hearts: 'must not propagate', password: 'not a credential' }]));
  const signal = new AbortController().signal;
  const data = await state.fetchInvitations(1, signal);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].isPublic, false);
  assert.equal(data.items[0].invitationCode, invitationCode);
  assert.equal(data.items[0].hearts, undefined);
  assert.equal(data.items[0].password, undefined);
  assert.equal(state.calls[0].url, '/api/paper/invitations?page=1');
  assert.equal(state.calls[0].signal, signal);
});

test('empty results, malformed records and transport failures remain distinct', async () => {
  assert.equal((await setup(() => page([])).fetchInvitations()).count, 0);
  for (const change of [{ invitationCode: 'bad' }, { code: 'bad' }, { title: '' }, { theme: 'unknown' },
    { receivingDate: '2099-02-30' }, { sentAt: 'invalid' }, { isPublic: undefined }]) {
    await assert.rejects(setup(() => page([{ ...invitation(), ...change }])).fetchInvitations());
  }
  await assert.rejects(setup(() => page([invitation(), invitation()])).fetchInvitations());
  for (const reply of [() => { throw new Error('offline'); }, () => ({ response: { status: 500 } })]) {
    await assert.rejects(setup(reply).fetchInvitations(), { message: '초대 목록을 불러오지 못했습니다. 다시 시도해주세요.' });
  }
});

test('pagination reconstructs API paths and never follows remote next URLs', async () => {
  const state = setup(() => ({ ...page(), payload: { data: { count: 21, results: [invitation()], next: 'https://untrusted.example/path' } } }));
  const result = await state.fetchInvitations();
  assert.equal(result.nextPage, 2);
  await state.fetchInvitations(result.nextPage);
  assert.equal(state.calls[1].url, '/api/paper/invitations?page=2');
});

test('accept and deny send only the invitation identity and explicit decision', async () => {
  const state = setup(() => ({ response: { status: 204 } }));
  const signal = new AbortController().signal;
  for (const action of ['accept', 'deny']) await state.respondToInvitation(invitationCode, action, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(state.calls.map(({ method, url, body }) => ({ method, url, body })))), [
    { method: 'POST', url: '/api/paper/invitations', body: { invitationCode, action: 'accept' } },
    { method: 'POST', url: '/api/paper/invitations', body: { invitationCode, action: 'deny' } },
  ]);
  assert.ok(state.calls.every(call => call.signal === signal));
});

test('conflicting, expired, blocked and ambiguous decisions never claim success or auto replay', async () => {
  for (const status of [403, 404, 409, 483, 500, 200]) {
    const state = setup(() => ({ response: { status } }));
    await assert.rejects(state.respondToInvitation(invitationCode, 'accept'), error => error instanceof state.InvitationError);
    assert.equal(state.calls.length, 1);
  }
  const state = setup(() => { throw new Error('reply lost'); });
  await assert.rejects(state.respondToInvitation(invitationCode, 'deny'), error => error.message.includes('처리 결과'));
  assert.equal(state.calls.length, 1);
});

test('invalid input never makes a request and authentication and cancellation remain distinguishable', async () => {
  const state = setup();
  await assert.rejects(state.respondToInvitation('bad', 'accept'));
  await assert.rejects(state.respondToInvitation(invitationCode, 'other'));
  for (const number of [0, -1, 1.5]) await assert.rejects(state.fetchInvitations(number));
  assert.equal(state.calls.length, 0);
  let cause;
  const failed = setup(() => { throw cause; });
  cause = new failed.AuthenticationRequiredError();
  await assert.rejects(failed.fetchInvitations(), error => error === cause);
  await assert.rejects(failed.respondToInvitation(invitationCode, 'accept'), error => error === cause);
  const controller = new AbortController(); controller.abort(); cause = new Error('aborted');
  await assert.rejects(failed.respondToInvitation(invitationCode, 'deny', controller.signal), error => error === cause);
});

