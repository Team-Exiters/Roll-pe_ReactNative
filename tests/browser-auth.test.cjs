const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { loadServices } = require('./helpers/auth-service.cjs');
const pendingKey = 'rollpe.browser-auth';
const tokenState = {
  access: 'access-token', refresh: 'refresh-token',
  user: { id: 1, name: '테스트', email: 'test@example.com', identifyCode: '123abc', provider: 'apple' },
};
function loadService(options) {
  const services = loadServices(options);
  return { ...services, service: services.load('browser-auth') };
}
function callback(request, params) {
  return { type: 'success', url: `${request.returnUrl}?${new URLSearchParams({ state: request.state, ...params })}` };
}
async function startWeb(context, provider = 'apple') {
  const request = await context.service.prepareBrowserRequest(provider);
  assert.equal(await context.service.completeBrowserSignIn(request), null);
  assert.equal(context.calls.navigate.at(-1), request.authorizationUrl);
  assert.equal(context.calls.open.length, 0);
  context.state.callback = callback(request, { code: 'c'.repeat(43) });
  return request;
}
function savedTokens(context) {
  return context.calls.saved.filter(({ key }) => key === 'rollpe.session');
}

test('disabled deployment does not prepare a login', async () => {
  const { service } = loadService({ enabled: false });
  assert.equal(await service.prepareBrowserRequest('apple'), null);
});

test('prepares independent state and S256 proofs without exposing the verifier in URLs', async () => {
  const { service } = loadService();
  const first = await service.prepareBrowserRequest('apple');
  const second = await service.prepareBrowserRequest('apple');
  const url = new URL(first.authorizationUrl);
  assert.equal(url.pathname, '/api/user/social/login/apple/start');
  assert.equal(url.searchParams.get('return_url'), 'http://localhost:8081/auth/apple');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(first.verifier).digest('base64url'));
  assert.ok(!first.authorizationUrl.includes(first.verifier));
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.verifier, second.verifier);
});

test('web survives a full page reload and finishes without a popup or opener', async () => {
  const first = loadService();
  const request = await startWeb(first);
  assert.equal(first.calls.fetch.length, 0);
  assert.equal(savedTokens(first).length, 0);
  const stored = JSON.parse(first.storage.get(pendingKey));
  assert.deepEqual(Object.keys(stored).sort(), ['expiresAt', 'provider', 'state', 'verifier']);
  const returned = loadService({ storage: first.storage });
  returned.state.callback = first.state.callback;
  returned.state.payload = { data: tokenState };
  assert.deepEqual(await returned.service.completeWebBrowserSignIn(), tokenState);
  assert.equal(returned.calls.fetch[0][0], 'https://api.example/api/user/social/login/apple/exchange');
  assert.deepEqual(JSON.parse(returned.calls.fetch[0][1].body), { code: 'c'.repeat(43), code_verifier: request.verifier });
  assert.equal(returned.calls.fetch[0][1].credentials, 'omit');
  assert.deepEqual(savedTokens(returned)[0].value, tokenState);
  assert.equal(returned.storage.has(pendingKey), false);
  assert.equal(returned.calls.history[0][2], '/auth/apple');
  await assert.rejects(returned.service.completeWebBrowserSignIn(), /다시 시도/);
  assert.equal(returned.calls.fetch.length, 1);
});

test('blocked storage stops before navigation and failed navigation removes its proof', async () => {
  const context = loadService();
  const request = await context.service.prepareBrowserRequest('apple');
  context.state.storageWriteError = new Error('storage disabled');
  await assert.rejects(context.service.completeBrowserSignIn(request), /브라우저 저장소/);
  assert.equal(context.calls.navigate.length, 0);
  assert.equal(context.calls.fetch.length, 0);
  context.state.storageWriteError = null;
  context.state.navigationError = new Error('navigation failed');
  await assert.rejects(context.service.completeBrowserSignIn(request), /로그인에 실패/);
  assert.equal(context.storage.has(pendingKey), false);
  context.state.navigationError = null;
  await startWeb(context);
});

test('missing, expired, malformed and implausible pending proofs never reach the API', async () => {
  for (const variant of ['missing', 'expired', 'future', 'json', 'state', 'verifier', 'provider']) {
    const context = loadService();
    await startWeb(context);
    const stored = JSON.parse(context.storage.get(pendingKey));
    if (variant === 'expired') stored.expiresAt = Date.now() - 1;
    if (variant === 'future') stored.expiresAt = Date.now() + 20 * 60 * 1000;
    if (variant === 'state') stored.state = 'bad-state';
    if (variant === 'verifier') stored.verifier = '';
    if (variant === 'provider') stored.provider = 'other';
    context.storage.set(pendingKey, variant === 'json' ? '{bad' : JSON.stringify(stored));
    if (variant === 'missing') context.storage.delete(pendingKey);
    await assert.rejects(context.service.completeWebBrowserSignIn(), /다시 시도/);
    assert.equal(context.calls.fetch.length, 0);
    assert.equal(savedTokens(context).length, 0);
    assert.equal(context.storage.has(pendingKey), false);
    assert.equal(context.calls.history[0][2], '/auth/apple');
  }
});

test('wrong state, origin, provider path, credentials, duplicate params, fragments and malformed codes are rejected', async () => {
  for (const variant of ['state', 'origin', 'path', 'username', 'duplicate-state', 'duplicate-code', 'duplicate-error', 'code-and-error', 'fragment', 'empty-error', 'invalid-code']) {
    const context = loadService();
    const request = await startWeb(context);
    let url = context.state.callback.url;
    if (variant === 'state') url = url.replace(request.state, 'wrong');
    if (variant === 'origin') url = url.replace('localhost:8081', 'evil.example');
    if (variant === 'path') url = url.replace('/auth/apple', '/auth/google');
    if (variant === 'username') url = url.replace('http://', 'http://attacker@');
    if (variant === 'duplicate-state') url += '&state=other';
    if (variant === 'duplicate-code') url += '&code=other';
    if (variant === 'duplicate-error') url = `${request.returnUrl}?state=${request.state}&error=cancelled&error=other`;
    if (variant === 'code-and-error') url += '&error=cancelled';
    if (variant === 'fragment') url += '#unexpected';
    if (variant === 'empty-error') url = `${request.returnUrl}?state=${request.state}&error=`;
    if (variant === 'invalid-code') url = url.replace('c'.repeat(43), 'bad-code');
    context.state.callback.url = url;
    await assert.rejects(context.service.completeWebBrowserSignIn());
    assert.equal(context.calls.fetch.length, 0);
    assert.equal(savedTokens(context).length, 0);
  }
});

test('web cancellation returns to sign-in and provider errors report failure instead of waiting', async () => {
  for (const error of ['cancelled', 'authentication_failed', 'email_required', 'account_conflict', 'account_inactive']) {
    const context = loadService();
    const request = await startWeb(context);
    context.state.callback = callback(request, { error });
    if (error === 'cancelled') assert.equal(await context.service.completeWebBrowserSignIn(), null);
    else await assert.rejects(context.service.completeWebBrowserSignIn(), /실패|이메일|계정/);
    assert.equal(context.calls.fetch.length, 0);
    assert.equal(savedTokens(context).length, 0);
    assert.equal(context.storage.has(pendingKey), false);
  }
});

test('network failures, server errors and malformed credentials never persist tokens', async () => {
  for (const variant of ['network', 'server', 'payload']) {
    const context = loadService();
    await startWeb(context);
    if (variant === 'network') context.state.networkError = new Error('offline');
    if (variant === 'server') { context.state.ok = false; context.state.payload = { message: '만료된 요청입니다.' }; }
    if (variant === 'payload') context.state.payload = { data: { access: 'incomplete' } };
    await assert.rejects(context.service.completeWebBrowserSignIn());
    assert.equal(context.calls.fetch.length, 1);
    assert.equal(savedTokens(context).length, 0);
  }
});

test('leaving the web callback during exchange does not save credentials', async () => {
  const context = loadService();
  await startWeb(context);
  const controller = new AbortController();
  let release;
  context.state.responseGate = new Promise(resolve => { release = resolve; });
  context.state.payload = { data: tokenState };
  const pending = context.service.completeWebBrowserSignIn(controller.signal);
  controller.abort(); release();
  await assert.rejects(pending);
  assert.equal(savedTokens(context).length, 0);
});

for (const provider of ['apple', 'google', 'kakao']) {
  test(`${provider} web return validates its provider and requires no duplicate client keys`, async () => {
    const context = loadService({ env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '', EXPO_PUBLIC_KAKAO_REST_API_KEY: '', EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY: '' } });
    await startWeb(context, provider);
    context.state.payload = { data: { ...tokenState, user: { ...tokenState.user, provider, email: null } } };
    assert.equal((await context.service.completeWebBrowserSignIn()).user.provider, provider);
    assert.equal(context.calls.fetch[0][0], `https://api.example/api/user/social/login/${provider}/exchange`);
    assert.equal(savedTokens(context).length, 1);
    assert.equal(await loadService({ env: { EXPO_PUBLIC_API_URL: '' } }).service.prepareBrowserRequest(provider), null);
  });
}

test('another provider in the server token state is rejected', async () => {
  const context = loadService();
  await startWeb(context, 'google');
  context.state.payload = { data: tokenState };
  await assert.rejects(context.service.completeWebBrowserSignIn());
  assert.equal(savedTokens(context).length, 0);
});

test('Android Apple retains its app scheme and exchanges the returned browser result', async () => {
  const { service, state, calls } = loadService({ platform: 'android' });
  const request = await service.prepareBrowserRequest('apple');
  assert.equal(request.returnUrl, 'rollpe://auth/apple');
  assert.equal(new URL(request.returnUrl).protocol, `${require('../app.json').expo.scheme}:`);
  state.callback = callback(request, { code: 'c'.repeat(43) });
  state.payload = { data: tokenState };
  assert.deepEqual(await service.completeBrowserSignIn(request), tokenState);
  assert.equal(calls.open.length, 1);
  assert.equal(calls.navigate.length, 0);
  assert.equal(calls.saved.length, 1);
});

test('cancelled or aborted Android browser callbacks never exchange or save credentials', async () => {
  const { service, state, calls } = loadService({ platform: 'android' });
  const request = await service.prepareBrowserRequest('apple');
  for (const result of [{ type: 'cancel' }, { type: 'dismiss' }, callback(request, { error: 'cancelled' })]) {
    state.callback = result;
    assert.equal(await service.completeBrowserSignIn(request), null);
  }
  let release;
  state.browserGate = new Promise(resolve => { release = resolve; });
  state.callback = callback(request, { code: 'c'.repeat(43) });
  const controller = new AbortController();
  const pending = service.completeBrowserSignIn(request, controller.signal);
  controller.abort(); release();
  assert.equal(await pending, null);
  assert.equal(await service.completeBrowserSignIn(request, controller.signal), null);
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.saved.length, 0);
});

test('native Google, Kakao and iOS Apple still use their native SDKs', async () => {
  assert.equal(await loadService({ platform: 'ios' }).service.prepareBrowserRequest('apple'), null);
  for (const provider of ['google', 'kakao']) {
    for (const platform of ['ios', 'android']) {
      assert.equal(await loadService({ platform }).service.prepareBrowserRequest(provider), null);
    }
  }
});
