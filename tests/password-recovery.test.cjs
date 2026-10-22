const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { attachAxiosTransport } = require('./helpers/axios-transport.cjs');
const { loadServices } = require('./helpers/auth-service.cjs');

const credentials = { identifyCode: 'Ab123x', token: 'd04abc-' + 'a'.repeat(32) };
const storedTokenState = {
  access: 'old-access', refresh: 'old-refresh',
  user: { id: 1, name: '기존 사용자', email: 'existing@example.com', identifyCode: 'Ab123x', provider: null },
};
function recoveryService({ status = 200, payload = { message: '요청되었습니다.' }, failure, timeout = false, jsonFailure, platform = 'ios' } = {}) {
  const auth = loadServices({ platform });
  const requests = [];
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const filename = name === 'shared-api'
      ? path.resolve(__dirname, '../src/lib/api.ts')
      : name === 'reset-link'
      ? path.resolve(__dirname, '../src/utils/reset-link.ts')
      : path.resolve(__dirname, `../src/features/password-recovery/${name}.ts`);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    cache.set(name, exports);
    let network;
    vm.runInNewContext(output, {
      exports, AbortController, Error,
      process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example' } },
      setTimeout: (fn, ms) => setTimeout(fn, timeout ? 1 : ms), clearTimeout,
      fetch: network = async (url, options) => {
        requests.push([url, options]);
        if (failure) throw failure;
        if (timeout) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
        return { ok: status >= 200 && status < 300, status, json: async () => {
          if (jsonFailure) throw jsonFailure;
          return payload;
        } };
      },
      require: (name) => {
        if (name === 'axios') return require('axios');
        if (name === 'react-native') return { Platform: { OS: 'web' } };
        if (name === '@/lib/api') return load('shared-api');
        if (name === '@/features/sign-in/token-state') return auth.load('token-state');
        if (name === '@/features/password-recovery/validation') return load('validation');
        if (name === '@/utils/reset-link') return load('reset-link');
        throw new Error(`Unexpected import ${name}`);
      },
    }, { filename });
    if (name === 'shared-api') attachAxiosTransport(exports.apiClient, network);
    return exports;
  }
  return { ...auth, requests, recovery: load('api'), validation: load('validation'), resetLink: load('reset-link') };
}

test('recovery validates the original iOS email/password rules and rejects duplicate or malformed reset params', () => {
  const { validation: v, resetLink } = recoveryService();
  assert.equal(v.isRecoveryEmail(' person@example.com '), true);
  for (const email of ['', 'bad', 'a@b', 'a b@example.com']) assert.equal(v.isRecoveryEmail(email), false);
  for (const password of ['abcd123!', 'ABCD123!', 'a'.repeat(125) + '1!?']) assert.equal(v.isRecoveryPassword(password), true);
  for (const password of ['', 'abc123!', 'abcdefgh!', 'abcd1234', 'a1!' + 'a'.repeat(126)]) assert.equal(v.isRecoveryPassword(password), false);
  assert.deepEqual(JSON.parse(JSON.stringify(resetLink.resetCredentials(credentials))), credentials);
  for (const params of [{}, { ...credentials, token: [credentials.token] }, { ...credentials, identifyCode: ['Ab123x'] },
    { ...credentials, identifyCode: 'bad' }, { ...credentials, token: 'missing-signature' }]) assert.equal(resetLink.resetCredentials(params), null);
});

test('requesting mail uses existing anonymous endpoint and never saves a login token state', async () => {
  const { recovery, requests, calls } = recoveryService();
  assert.equal(await recovery.requestPasswordEmail(' person@example.com '), '요청되었습니다.');
  assert.equal(requests[0][0], 'https://api.example/api/user/forgot-password');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(requests[0][1].credentials, 'omit');
  assert.deepEqual(JSON.parse(requests[0][1].body), { email: 'person@example.com' });
  assert.equal(requests[0][1].headers.Authorization, undefined);
  assert.equal(calls.saved.length, 0);
});

test('successful reset sends exact PATCH fields and clears both memory and secure storage token states', async () => {
  const { load, recovery, requests, calls, storage } = recoveryService();
  await load('token-state').saveTokenState(storedTokenState);
  assert.equal(await recovery.resetPassword(credentials, 'abcd123!'), '요청되었습니다.');
  assert.equal(requests[0][1].method, 'PATCH');
  assert.equal(requests[0][1].credentials, 'omit');
  assert.deepEqual(JSON.parse(requests[0][1].body), { ...credentials, newPassword: 'abcd123!' });
  assert.equal(storage.has('rollpe.session'), false);
  assert.equal(await load('token-state').getTokenState(), null);
  assert.equal(calls.saved.length, 1); // Only the preexisting token state, never a recovery response.
});

test('expired and reused links offer fresh-email recovery without changing stored token state', async () => {
  const { recovery, calls } = recoveryService({ status: 400, payload: { message: '인증 링크가 만료되었습니다.' } });
  await assert.rejects(recovery.resetPassword(credentials, 'abcd123!'), (error) => error.invalidLink && /만료/.test(error.message));
  assert.equal(calls.deleted.length, 0);
  assert.equal(calls.saved.length, 0);
});

test('missing credentials and invalid password are rejected before any request', async () => {
  const { recovery, requests } = recoveryService();
  await assert.rejects(recovery.resetPassword({ ...credentials, token: [] }, 'abcd123!'));
  await assert.rejects(recovery.resetPassword(credentials, 'short'));
  assert.throws(() => recovery.requestPasswordEmail('bad'));
  assert.equal(requests.length, 0);
});

test('network, timeout, malformed and server failures are bounded and cannot clear token states', async () => {
  for (const options of [{ failure: new Error('offline') }, { timeout: true }, { payload: [] }, { status: 503 }, { jsonFailure: new SyntaxError('invalid JSON') }]) {
    const { recovery, calls } = recoveryService(options);
    await assert.rejects(recovery.resetPassword(credentials, 'abcd123!'),
      options.jsonFailure ? /서버에 연결하지 못했습니다/ : undefined);
    assert.equal(calls.deleted.length, 0);
    assert.equal(calls.saved.length, 0);
  }
});


test('a completed server reset stays successful if local deletion fails, without restoring the running token state', async () => {
  for (const platform of ['ios', 'web']) {
    const { load, recovery, requests, storage, state } = recoveryService({ platform });
    await load('token-state').saveTokenState(storedTokenState);
    state.storageDeleteError = new Error('storage unavailable');
    const message = await recovery.resetPassword(credentials, 'abcd123!');
    assert.match(message, /요청되었습니다/);
    assert.match(message, /로그인 정보를 삭제하지 못했습니다/);
    assert.equal(requests.length, 1);
    assert.equal(storage.has('rollpe.session'), true); // Persistence failure is reported, never hidden.
    assert.equal(await load('token-state').getTokenState(), null); // Do not reload the stale stored token state.
  }
});
