const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { loadServices } = require('./helpers/auth-service.cjs');

function loadService(options) {
  const services = loadServices(options);
  return { ...services, service: services.load('browser-auth') };
}

function callback(request, params) {
  return { type: 'success', url: `${request.returnUrl}?${new URLSearchParams({ state: request.state, ...params })}` };
}

const tokenState = {
  access: 'access-token', refresh: 'refresh-token',
  user: { id: 1, name: '테스트', email: 'test@example.com', identifyCode: '123abc', provider: 'apple' },
};

test('disabled deployment does not prepare a login', async () => {
  const { service, calls } = loadService({ enabled: false });
  assert.equal(await service.prepareBrowserRequest('apple'), null);
  assert.equal(calls.open.length, 0);
});

test('a browser callback arriving after leaving sign-in is not exchanged or saved', async () => {
  for (const platform of ['web', 'android']) {
    const { service, state, calls } = loadService({ platform });
    const request = await service.prepareBrowserRequest('apple');
    let release;
    state.browserGate = new Promise(resolve => { release = resolve; });
    state.callback = callback(request, { code: 'c'.repeat(43) });
    state.payload = { data: tokenState };
    const controller = new AbortController();
    const pending = service.completeBrowserSignIn(request, controller.signal);
    controller.abort(); release();
    assert.equal(await pending, null);
    assert.equal(calls.fetch.length, 0);
    assert.equal(calls.saved.length, 0);
    assert.equal(await service.completeBrowserSignIn(request, controller.signal), null);
    assert.equal(calls.open.length, 1);
  }
});

test('prepares an independent state and S256 proof for each attempt', async () => {
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

test('successful browser return exchanges the bound proof before saving a token state', async () => {
  const { service, state, calls } = loadService();
  const request = await service.prepareBrowserRequest('apple');
  state.callback = callback(request, { code: 'c'.repeat(43) });
  state.payload = { data: tokenState };
  assert.deepEqual(await service.completeBrowserSignIn(request), tokenState);
  assert.equal(calls.fetch[0][0], 'https://api.example/api/user/social/login/apple/exchange');
  assert.equal(JSON.parse(calls.fetch[0][1].body).code_verifier, request.verifier);
  assert.equal(calls.fetch[0][1].credentials, 'omit');
  assert.deepEqual(calls.saved[0].value, tokenState);
});

test('an Apple account without an email is identified by the server account', async () => {
  const { service, state, calls } = loadService();
  const request = await service.prepareBrowserRequest('apple');
  state.callback = callback(request, { code: 'c'.repeat(43) });
  state.payload = { data: { ...tokenState, user: { ...tokenState.user, email: null } } };
  assert.equal((await service.completeBrowserSignIn(request)).user.email, null);
  assert.equal(calls.saved.length, 1);
});

test('rejects wrong state, origin, path, duplicated params, and fragment before exchanging', async () => {
  for (const variant of ['state', 'origin', 'path', 'duplicate-state', 'duplicate-code', 'fragment']) {
    const { service, state, calls } = loadService();
    const request = await service.prepareBrowserRequest('apple');
    const result = callback(request, { code: 'c'.repeat(43) });
    if (variant === 'state') result.url = result.url.replace(request.state, 'wrong');
    if (variant === 'origin') result.url = result.url.replace('localhost:8081', 'evil.example');
    if (variant === 'path') result.url = result.url.replace('/auth/apple', '/other');
    if (variant === 'duplicate-state') result.url += '&state=other';
    if (variant === 'duplicate-code') result.url += '&code=other';
    if (variant === 'fragment') result.url += '#unexpected';
    state.callback = result;
    await assert.rejects(service.completeBrowserSignIn(request));
    assert.equal(calls.fetch.length, 0);
    assert.equal(calls.saved.length, 0);
  }
});

test('cancelled auth never fetches or persists credentials', async () => {
  const { service, state, calls } = loadService();
  const request = await service.prepareBrowserRequest('apple');
  for (const result of [{ type: 'cancel' }, { type: 'dismiss' }, callback(request, { error: 'cancelled' })]) {
    state.callback = result;
    assert.equal(await service.completeBrowserSignIn(request), null);
  }
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.saved.length, 0);
});

test('server errors and malformed credentials do not become successful token states', async () => {
  const { service, state, calls } = loadService();
  const request = await service.prepareBrowserRequest('apple');
  state.callback = callback(request, { code: 'c'.repeat(43) });
  state.ok = false;
  state.payload = { message: '만료된 요청입니다.' };
  await assert.rejects(service.completeBrowserSignIn(request), /만료된 요청/);
  state.ok = true;
  state.payload = { data: { access: 'incomplete' } };
  await assert.rejects(service.completeBrowserSignIn(request));
  assert.equal(calls.saved.length, 0);
});

test('Android Apple returns to the configured app scheme and iOS uses the native SDK', async () => {
  for (const platform of ['android']) {
    const { service } = loadService({ platform });
    const request = await service.prepareBrowserRequest('apple');
    assert.equal(request.returnUrl, 'rollpe://auth/apple');
    assert.equal(new URL(request.returnUrl).protocol, `${require('../app.json').expo.scheme}:`);
  }
  assert.equal(await loadService({ platform: 'ios' }).service.prepareBrowserRequest('apple'), null);
});

for (const provider of ['google', 'kakao']) {
  test(`${provider} web login exchanges a provider-bound code and PKCE proof`, async () => {
    const { service, state, calls } = loadService();
    const request = await service.prepareBrowserRequest(provider);
    const url = new URL(request.authorizationUrl);
    assert.equal(request.returnUrl, `http://localhost:8081/auth/${provider}`);
    assert.equal(url.pathname, `/api/user/social/login/${provider}/start`);
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(request.verifier).digest('base64url'));
    assert.equal(url.searchParams.has('client_secret'), false);
    state.callback = callback(request, { code: 'c'.repeat(43) });
    state.payload = { data: { ...tokenState, user: { ...tokenState.user, provider } } };
    assert.equal((await service.completeBrowserSignIn(request)).user.provider, provider);
    assert.equal(calls.fetch[0][0], `https://api.example/api/user/social/login/${provider}/exchange`);
    assert.deepEqual(JSON.parse(calls.fetch[0][1].body), { code: 'c'.repeat(43), code_verifier: request.verifier });
    assert.equal(calls.saved.length, 1);
  });

  test(`${provider} web login relies on server configuration without requiring duplicate client keys`, async () => {
    const { service, state, calls } = loadService({ env: {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '',
      EXPO_PUBLIC_KAKAO_REST_API_KEY: '',
      EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY: '',
      EXPO_PUBLIC_KAKAO_APP_ID: '',
    } });
    const request = await service.prepareBrowserRequest(provider);
    assert.ok(request);
    state.callback = callback(request, { code: 'c'.repeat(43) });
    state.payload = { data: { ...tokenState, user: { ...tokenState.user, provider } } };
    assert.equal((await service.completeBrowserSignIn(request)).user.provider, provider);
    assert.equal(calls.saved.length, 1);
    assert.equal(await loadService({ env: { EXPO_PUBLIC_API_URL: '' } }).service.prepareBrowserRequest(provider), null);
  });

  test(`${provider} browser flow does not replace the native SDK`, async () => {
    for (const platform of ['ios', 'android']) {
      assert.equal(await loadService({ platform }).service.prepareBrowserRequest(provider), null);
    }
  });

  test(`${provider} rejects another provider's return or server token state`, async () => {
    const { service, state, calls } = loadService();
    const request = await service.prepareBrowserRequest(provider);
    state.callback = callback(request, { code: 'c'.repeat(43) });
    state.callback.url = state.callback.url.replace(`/auth/${provider}`, '/auth/apple');
    await assert.rejects(service.completeBrowserSignIn(request));
    assert.equal(calls.fetch.length, 0);
    state.callback = callback(request, { code: 'c'.repeat(43) });
    state.payload = { data: tokenState };
    await assert.rejects(service.completeBrowserSignIn(request));
    assert.equal(calls.saved.length, 0);
  });
}

test('blocked popups explain how to retry without exchanging or saving a token state', async () => {
  const { service, state, calls } = loadService();
  const request = await service.prepareBrowserRequest('google');
  state.browserError = Object.assign(new Error('Popup window was blocked by the browser'), {
    code: 'ERR_WEB_BROWSER_BLOCKED',
  });
  await assert.rejects(service.completeBrowserSignIn(request), /팝업.*허용/);
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.saved.length, 0);
  state.browserError = null;
  const retry = await service.prepareBrowserRequest('google');
  state.callback = callback(retry, { code: 'c'.repeat(43) });
  state.payload = { data: { ...tokenState, user: { ...tokenState.user, provider: 'google' } } };
  assert.equal((await service.completeBrowserSignIn(retry)).user.provider, 'google');
});

test('ambiguous errors, credentials in callback URLs, and invalid exchange codes never reach the API', async () => {
  for (const variant of ['duplicate-error', 'code-and-error', 'username', 'empty-error', 'invalid-code']) {
    const { service, state, calls } = loadService();
    const request = await service.prepareBrowserRequest('google');
    const result = callback(request, { code: 'c'.repeat(43) });
    if (variant === 'duplicate-error') result.url = `${request.returnUrl}?state=${request.state}&error=cancelled&error=other`;
    if (variant === 'code-and-error') result.url += '&error=cancelled';
    if (variant === 'username') result.url = result.url.replace('http://', 'http://attacker@');
    if (variant === 'empty-error') result.url = `${request.returnUrl}?state=${request.state}&error=`;
    if (variant === 'invalid-code') result.url = result.url.replace('c'.repeat(43), 'bad-code');
    state.callback = result;
    await assert.rejects(service.completeBrowserSignIn(request));
    assert.equal(calls.fetch.length, 0);
    assert.equal(calls.saved.length, 0);
  }
});
