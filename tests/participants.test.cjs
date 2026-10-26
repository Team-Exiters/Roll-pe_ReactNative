const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
const member = { id: 3, name: '참여자', identifyCode: 'User03', isHost: false, isReceiver: false, hasWritten: true, revisionCount: 2, heartCode: code };
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
  return { participants: load('features/rollpe-info/participants'), calls, AuthenticationRequiredError };
}
test('participant lists include nonwriters and edited counts and use authenticated cancellation', async () => {
  const { participants, calls } = setup(() => ({ response: { ok: true }, payload: { data: { users: [member, {
    ...member, id: 4, hasWritten: false, revisionCount: 0, heartCode: null,
  }] } } }));
  const signal = new AbortController().signal;
  const users = await participants.fetchParticipants(code.replaceAll('-', '').toUpperCase(), signal);
  assert.equal(users.length, 2);
  assert.equal(users[0].revisionCount, 2);
  assert.equal(calls[0].url, `/api/paper/participants?pcode=${code}`);
  assert.equal(calls[0].signal, signal);
});
test('malformed member lists and invalid targets are rejected before a mutation', async () => {
  for (const users of [[member, member], [{ ...member, revisionCount: -1 }], [{ ...member, hasWritten: false }], [{ ...member, id: 0 }]]) {
    const { participants } = setup(() => ({ response: { ok: true }, payload: { data: { users } } }));
    await assert.rejects(participants.fetchParticipants(code));
  }
  const { participants, calls } = setup(() => { throw new Error('should not call'); });
  await assert.rejects(participants.fetchParticipants('bad'));
  await assert.rejects(participants.inviteParticipant(code, 0));
  await assert.rejects(participants.kickParticipant(code, 1.5));
  assert.equal(calls.length, 0);
});
test('invitation, kick and leave send only the specified paper and target via original auth transport', async () => {
  const { participants, calls } = setup(() => ({ response: { status: 204 } }));
  const signal = new AbortController().signal;
  await participants.inviteParticipant(code, 3, signal);
  await participants.kickParticipant(code, 3, signal);
  await participants.leaveRollpe(code, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.map(({ method, url, body }) => ({ method, url, body })))), [
    { method: 'POST', url: '/api/paper/participants', body: { pcode: code, userId: 3 } },
    { method: 'DELETE', url: '/api/paper/participants', body: { pcode: code, userId: 3 } },
    { method: 'POST', url: '/api/paper/leave', body: { pcode: code } },
  ]);
  assert.ok(calls.every(call => call.signal === signal));
});
test('blocked, protected, closed and ambiguous membership mutations never claim success or replay', async () => {
  for (const [status, reason] of [[403, 'blocked'], [403, 'protected'], [483], [500], [200]]) {
    const { participants, calls } = setup(() => ({ response: { status }, payload: { data: { reason } } }));
    await assert.rejects(participants.kickParticipant(code, 3), error => error instanceof participants.ParticipantError);
    assert.equal(calls.length, 1);
  }
  const { participants, calls } = setup(() => { throw new Error('reply lost'); });
  await assert.rejects(participants.leaveRollpe(code), error => error.reload);
  assert.equal(calls.length, 1);
});
test('authentication and explicit cancellation remain distinguishable from ambiguous writes', async () => {
  let fault;
  const state = setup(() => { throw fault; });
  fault = new state.AuthenticationRequiredError();
  await assert.rejects(state.participants.inviteParticipant(code, 3), error => error === fault);
  const controller = new AbortController(); controller.abort(); fault = new Error('cancelled');
  await assert.rejects(state.participants.kickParticipant(code, 3, controller.signal), error => error === fault);
});
