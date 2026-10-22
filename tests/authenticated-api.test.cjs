const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { attachAxiosTransport } = require('./helpers/axios-transport.cjs');

const original = { access: 'old-access', refresh: 'old-refresh', user: {
  id: 1, name: 'Test', email: null, identifyCode: 'Test12', provider: null,
} };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function setup(reply, platform = 'ios', fastTimeout = false) {
  const storage = new Map();
  const calls = [];
  const writes = [];
  const modules = new Map();
  let writeGate;
  let writeError;
  let onWrite;
  let deleteGate;
  let onDelete;
  const secure = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: async key => storage.get(key) ?? null,
    setItemAsync: async (key, value) => {
      writes.push(value); onWrite?.();
      if (writeGate) await writeGate;
      if (writeError) throw writeError;
      storage.set(key, value);
    },
    deleteItemAsync: async key => { onDelete?.(); if (deleteGate) await deleteGate; storage.delete(key); },
  };
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const filename = path.resolve(__dirname, '../src', name === 'token-state' ? 'features/sign-in/token-state.ts' : `lib/${name}.ts`);
    const exports = {};
    modules.set(name, exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { exports, AbortController,
      setTimeout: (callback, ms) => setTimeout(callback, fastTimeout ? 1 : ms), clearTimeout, Error,
      process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example' } },
      window: { sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } },
      require: name => {
        if (name === 'axios') return require('axios');
        if (name === 'react-native') return { Platform: { OS: platform } };
        if (name === 'expo-secure-store') return secure;
        if (name === '@/features/sign-in/token-state') return load('token-state');
        if (name === '@/lib/api') return load('api');
        throw Error(`Unexpected import ${name}`);
      },
    }, { filename });
    if (name === 'api') attachAxiosTransport(exports.apiClient, async (url, options) => {
      calls.push({ url, ...options });
      const result = await reply({ url, ...options });
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
    });
    return exports;
  }
  return { tokenState: load('token-state'), api: load('authenticated-api'), calls, storage, writes,
    blockWrites(gate, started) { writeGate = gate; onWrite = started; },
    failWrites(error) { writeError = error; },
    blockDeletes(gate, started) { deleteGate = gate; onDelete = started; } };
}
const ok = body => ({ status: 200, body });
const unauthorized = { status: 401, body: { detail: 'expired' } };

test('401 refreshes once, checks rotation and retries with bearer while preserving nonretention', async () => {
  const env = setup(({url, headers}) => url.endsWith('/token/refresh') ? ok({ access: 'new-access', refresh: 'rotated' })
    : headers.authorization === 'Bearer old-access' ? unauthorized : ok({ value: 1 }));
  await env.tokenState.saveTokenState(original, false);
  assert.equal((await env.api.authenticatedGet('/api/home')).payload.value, 1);
  assert.equal(env.calls.length, 3);
  assert.equal(env.calls[1].headers.authorization, undefined);
  assert.equal(JSON.parse(env.calls[1].body).refresh, 'old-refresh');
  assert.equal((await env.tokenState.getTokenState()).refresh, 'rotated');
  assert.equal(env.storage.size, 0);
  for (const call of env.calls) assert.equal(call.credentials, 'omit');
});

test('a GET 401 with a non-JSON body still refreshes and retries', async () => {
  const env = setup(({ url, headers }) => url.endsWith('/token/refresh') ? ok({ access: 'new-access' })
    : headers.authorization === 'Bearer old-access' ? new Response('Unauthorized', { status: 401 }) : ok({ value: 1 }));
  await env.tokenState.saveTokenState(original);
  assert.equal((await env.api.authenticatedGet('/api/home')).payload.value, 1);
  assert.equal(env.calls.length, 3);
});

test('concurrent 401 requests share a single refresh and retained rotation is persisted', async () => {
  const gate = deferred();
  let refreshes = 0;
  const env = setup(async ({url, headers}) => {
    if (url.endsWith('/token/refresh')) { refreshes++; await gate.promise; return ok({access:'new-access'}); }
    return headers.authorization === 'Bearer old-access' ? unauthorized : ok({ value: 1 });
  });
  await env.tokenState.saveTokenState(original);
  const requests = [env.api.authenticatedGet('/api/first'), env.api.authenticatedGet('/api/second')];
  await new Promise(r => setTimeout(r, 15));
  gate.resolve();
  await Promise.all(requests);
  assert.equal(refreshes, 1);
  assert.equal(JSON.parse(env.storage.get('rollpe.session')).access, 'new-access');
});

test('refresh 400/401 and a repeated 401 clear only the failed token state', async () => {
  for (const status of [400, 401, 200]) {
    const env = setup(({url}) => url.endsWith('/token/refresh')
      ? {status, body:{access:'new-access'}} : unauthorized);
    await env.tokenState.saveTokenState(original);
    await assert.rejects(env.api.authenticatedGet('/api/home'), env.api.AuthenticationRequiredError);
    assert.equal(await env.tokenState.getTokenState(), null);
    assert.equal(env.storage.size, 0);
    assert.equal(env.calls.filter(call => call.url.endsWith('/token/refresh')).length, 1);
  }
});

test('network, 5xx and malformed refresh do not clear credentials', async () => {
  for (const result of [new Error('offline'), {status:503,body:{}}, ok({access:''}), ok({access:'new',refresh:123})]) {
    const env = setup(({url}) => {
      if (!url.endsWith('/token/refresh')) return unauthorized;
      if (result instanceof Error) throw result;
      return result;
    });
    await env.tokenState.saveTokenState(original);
    await assert.rejects(env.api.authenticatedGet('/api/home'));
    assert.equal((await env.tokenState.getTokenState()).access, 'old-access');
    assert.equal(env.storage.size, 1);
  }
});

test('late refresh cannot restore a cleared token state or overwrite a new login', async () => {
  for (const newLogin of [false, true]) {
    const gate = deferred();
    const started = deferred();
    const env = setup(async ({url}) => {
      if (url.endsWith('/token/refresh')) { started.resolve(); await gate.promise; return ok({access:'late'}); }
      return unauthorized;
    });
    await env.tokenState.saveTokenState(original);
    const request = env.api.authenticatedGet('/api/home');
    const rejection = assert.rejects(request);
    await started.promise;
    await env.tokenState.clearTokenState();
    if (newLogin) await env.tokenState.saveTokenState({...original,access:'other'}, false);
    gate.resolve();
    await rejection;
    assert.equal((await env.tokenState.getTokenState())?.access ?? null, newLogin ? 'other' : null);
    assert.equal(env.storage.size, 0);
  }
});

test('clearing during a pending retained write wins in memory and storage', async () => {
  const gate = deferred();
  const env = setup(() => ok({}));
  env.blockWrites(gate.promise);
  const save = env.tokenState.saveTokenState(original);
  await new Promise(r => setTimeout(r, 0));
  const clear = env.tokenState.clearTokenState();
  gate.resolve();
  await Promise.all([save, clear]);
  assert.equal(await env.tokenState.getTokenState(), null);
  assert.equal(env.storage.size, 0);
});

test('cancelled caller does not cancel another caller shared refresh or clear token state', async () => {
  const gate = deferred(); const started = deferred();
  const env = setup(async ({url,headers}) => {
    if (url.endsWith('/token/refresh')) { started.resolve(); await gate.promise; return ok({access:'new-access'}); }
    return headers.authorization === 'Bearer old-access' ? unauthorized : ok({value:1});
  });
  await env.tokenState.saveTokenState(original, false);
  const controller = new AbortController();
  const first = env.api.authenticatedGet('/api/first',controller.signal);
  const rejected = assert.rejects(first);
  const second = env.api.authenticatedGet('/api/second');
  await started.promise;
  controller.abort();
  await rejected;
  gate.resolve();
  assert.equal((await second).payload.value, 1);
  assert.equal((await env.tokenState.getTokenState()).access, 'new-access');
});

test('external or traversal paths and missing/cancelled token state send no bearer request', async () => {
  const env = setup(() => ok({}));
  await env.tokenState.saveTokenState(original);
  for (const path of ['https://evil.example/api/home','//evil.example/api/home','/api/../evil','/api/%2e%2e/home','/api/home#secret','/api/\\evil']) {
    await assert.rejects(env.api.authenticatedGet(path));
  }
  const controller = new AbortController();controller.abort();
  await assert.rejects(env.api.authenticatedGet('/api/home',controller.signal));
  await env.tokenState.clearTokenState();
  await assert.rejects(env.api.authenticatedGet('/api/home'), env.api.AuthenticationRequiredError);
  assert.equal(env.calls.length, 0);
});

test('a stale refresh cannot report the new login as signed out', async () => {
  for (const status of [200, 400, 401]) {
    const gate = deferred();
    const started = deferred();
    const env = setup(async ({ url }) => {
      if (!url.endsWith('/token/refresh')) return unauthorized;
      started.resolve();
      await gate.promise;
      return { status, body: { access: 'late-access' } };
    });
    await env.tokenState.saveTokenState(original);
    const pending = env.api.authenticatedGet('/api/home');
    const rejected = assert.rejects(pending, error => !(error instanceof env.api.AuthenticationRequiredError));
    await started.promise;
    await env.tokenState.saveTokenState({ ...original, access: 'other-login' }, false);
    gate.resolve();
    await rejected;
    assert.equal((await env.tokenState.getTokenState()).access, 'other-login');
  }
});

test('an old retry 401 cannot report a replacement login as signed out', async () => {
  const gate = deferred();
  const retrying = deferred();
  const env = setup(async ({ url, headers }) => {
    if (url.endsWith('/token/refresh')) return ok({ access: 'rotated-access' });
    if (headers.authorization === 'Bearer rotated-access') {
      retrying.resolve();
      await gate.promise;
    }
    return unauthorized;
  });
  await env.tokenState.saveTokenState(original);
  const pending = env.api.authenticatedGet('/api/home');
  const rejected = assert.rejects(pending, error => !(error instanceof env.api.AuthenticationRequiredError));
  await retrying.promise;
  await env.tokenState.saveTokenState({ ...original, access: 'other-login' }, false);
  gate.resolve();
  await rejected;
  assert.equal((await env.tokenState.getTokenState()).access, 'other-login');
});

test('a revoked refresh finishing deletion cannot sign out a login saved during that deletion', async () => {
  const gate = deferred();
  const deleting = deferred();
  const env = setup(() => unauthorized);
  await env.tokenState.saveTokenState(original);
  env.blockDeletes(gate.promise, deleting.resolve);
  const pending = env.api.authenticatedGet('/api/home');
  const rejected = assert.rejects(pending, error => !(error instanceof env.api.AuthenticationRequiredError));
  await deleting.promise;
  const saving = env.tokenState.saveTokenState({ ...original, access: 'other-login' });
  gate.resolve();
  await saving;
  await rejected;
  assert.equal((await env.tokenState.getTokenState()).access, 'other-login');
  assert.equal(JSON.parse(env.storage.get('rollpe.session')).access, 'other-login');
});
