const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const calls = [], cache = new Map();
  const original = { generation: 1, revision: 1, tokenState: { access: 'local-access', refresh: 'local-refresh',
    user: { id: 1, identifyCode: 'User01', provider: null } } };
  const state = { snapshot: original, reply: { response: { status: 200, ok: true }, payload: { message: '처리되었습니다.' } }, cleared: 0 };
  class AuthenticationRequiredError extends Error {}
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const filename = path.resolve(__dirname, '../src', `${file}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Error, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/features/sign-in/token-state') return {
        getTokenSnapshot: async () => state.snapshot,
        clearTokenStateIfCurrent: async snapshot => {
          if (snapshot !== state.snapshot) return;
          state.cleared++; state.snapshot = null;
          state.afterClear?.();
          if (state.clearError) throw state.clearError;
        },
      };
      if (name === '@/lib/authenticated-api') return { AuthenticationRequiredError,
        authenticatedTokenMutation: async (url, method, body, signal) => {
          if (signal?.aborted) throw new Error('cancelled');
          if (state.requestError) throw state.requestError;
          if (state.rotate) state.snapshot = { ...state.snapshot, revision: 2, tokenState: { ...state.snapshot.tokenState, refresh: 'rotated-refresh' } };
          calls.push({ url, method, body: body(state.snapshot), signal });
          state.afterRequest?.();
          return state.reply;
        } };
      return load(name.slice(2));
    } }, { filename });
    return exports;
  }
  return { api: load('features/my-page/account-api'), calls, state, original, AuthenticationRequiredError };
}

test('logout, withdrawal and password change use original endpoints with current credentials and clear retained login', async () => {
  for (const [action, method, endpoint] of [['logout', 'POST', 'logout'], ['withdraw', 'DELETE', 'drop-user'], ['changePassword', 'PATCH', 'change-password']]) {
    const env = setup(); env.state.rotate = true;
    const signal = new AbortController().signal;
    assert.equal(await env.api.changeAccount(action, 'New-password1!', signal), '처리되었습니다.');
    const call = env.calls[0];
    assert.equal(call.url, `/api/user/${endpoint}`);
    assert.equal(call.method, method);
    assert.equal(call.signal, signal);
    assert.deepEqual(JSON.parse(JSON.stringify(call.body)), { refresh: 'rotated-refresh',
      ...(action === 'withdraw' ? { identifyCode: 'User01' } : {}), ...(action === 'changePassword' ? { newPassword: 'New-password1!' } : {}) });
    assert.equal(env.state.snapshot, null);
    assert.equal(env.state.cleared, 1);
  }
});

test('invalid password policy, unsupported action, social password changes and missing withdrawal identity never send a mutation', async () => {
  const env = setup();
  for (const value of ['', 'short', 'onlyletters', 'Password1', ' New-password1! ']) await assert.rejects(env.api.changeAccount('changePassword', value));
  await assert.rejects(env.api.changeAccount('unknown'));
  env.state.snapshot.tokenState.user.provider = 'google';
  await assert.rejects(env.api.changeAccount('changePassword', 'New-password1!'));
  env.state.snapshot.tokenState.user.identifyCode = null;
  await assert.rejects(env.api.changeAccount('withdraw'));
  assert.equal(env.calls.length, 0);
  assert.equal(env.state.cleared, 0);
});

test('network failures, domain denials and malformed successes preserve local login and never replay automatically', async () => {
  for (const reply of [{ response: { status: 400, ok: false }, payload: { message: '같은 비밀번호입니다.' } },
    { response: { status: 500, ok: false } }, { response: { status: 200, ok: true }, payload: {} },
    { response: { status: 200, ok: true }, payload: { message: ' ' } }]) {
    const env = setup(); env.state.reply = reply;
    await assert.rejects(env.api.changeAccount('logout'));
    assert.equal(env.calls.length, 1);
    assert.equal(env.state.cleared, 0);
  }
  const env = setup(); env.state.requestError = new Error('offline');
  await assert.rejects(env.api.changeAccount('logout'), error => error.message.includes('처리 결과'));
  assert.equal(env.state.cleared, 0);
});

test('an account action cannot clear a newer login and storage cleanup failure does not undo server success', async () => {
  const env = setup();
  env.state.afterRequest = () => { env.state.snapshot = { ...env.original, generation: 2 }; };
  await assert.rejects(env.api.changeAccount('withdraw'));
  assert.equal(env.state.snapshot.generation, 2);
  assert.equal(env.state.cleared, 0);
  const cleanup = setup(); cleanup.state.clearError = new Error('storage unavailable');
  const message = await cleanup.api.changeAccount('logout');
  assert.ok(message.startsWith('처리되었습니다.'));
  assert.ok(message.includes('기기의 로그인 정보 삭제'));
  const concurrent = setup();
  concurrent.state.afterClear = () => { concurrent.state.snapshot = { ...concurrent.original, generation: 2 }; };
  await assert.rejects(concurrent.api.changeAccount('logout'), error => error.message.includes('로그인'));
  assert.equal(concurrent.state.snapshot.generation, 2);
});

test('absent credentials, authentication expiry and explicit cancellation remain distinguishable', async () => {
  const env = setup(); env.state.snapshot = null;
  await assert.rejects(env.api.changeAccount('logout'), env.AuthenticationRequiredError);
  const expired = setup(); expired.state.requestError = new expired.AuthenticationRequiredError();
  await assert.rejects(expired.api.changeAccount('logout'), error => error === expired.state.requestError);
  const aborted = setup(), controller = new AbortController(); controller.abort();
  await assert.rejects(aborted.api.changeAccount('logout', undefined, controller.signal), { message: 'cancelled' });
  assert.equal(aborted.state.cleared, 0);
});
