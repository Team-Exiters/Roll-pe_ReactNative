const assert = require('node:assert/strict');
const test = require('node:test');
const { loadServices } = require('./helpers/auth-service.cjs');

function session(provider = null) {
  return {
    access: 'api-access', refresh: 'api-refresh',
    user: { id: 7, name: '테스트', email: 'test@example.com', identifyCode: 'abcdef', provider },
  };
}

test('email accepts the original 201 response with a null provider and preserves the password', async () => {
  const { load, calls, state } = loadServices({ platform: 'ios' });
  state.payload = { data: session() };
  const result = await load('api').signInWithEmail({ email: ' test@example.com ', password: ' password ', keepSignIn: true });
  assert.equal(result.user.provider, null);
  assert.equal(calls.fetch[0][0], 'https://api.example/api/user/signin');
  assert.deepEqual(JSON.parse(calls.fetch[0][1].body), { email: 'test@example.com', password: ' password ' });
  assert.equal(calls.fetch[0][1].credentials, 'omit');
  assert.equal(calls.saved[0].options.keychainAccessible, 'device-only');
});

test('rejected credentials, malformed replies, and network errors never save a session', async () => {
  for (const variant of ['rejected', 'malformed', 'network', 'json']) {
    const { load, calls, state } = loadServices({ platform: 'ios' });
    state.ok = variant === 'malformed';
    state.payload = { message: '로그인할 수 없습니다.', data: { access: 'incomplete' } };
    if (variant === 'network') state.networkError = new Error('offline');
    if (variant === 'json') state.jsonError = new SyntaxError('invalid JSON');
    await assert.rejects(load('api').signInWithEmail({ email: 'a@example.com', password: 'pw', keepSignIn: true }),
      variant === 'json' ? /로그인 서버에 연결하지 못했습니다/ : undefined);
    assert.equal(calls.saved.length, 0);
  }
});

test('Google sends its ID token and Kakao sends its access token to the original API', async () => {
  for (const provider of ['google', 'kakao']) {
    const { load, calls, state } = loadServices({ platform: 'ios' });
    state.payload = { data: session(provider) };
    const credential = await load('social.native').authorizeNative(provider);
    await load('api').signInWithSocial(provider, credential);
    assert.equal(calls.fetch[0][0], `https://api.example/api/user/social/login/${provider}`);
    assert.equal(JSON.parse(calls.fetch[0][1].body).accessToken,
      provider === 'google' ? 'google-id-token' : 'kakao-access-token');
    if (provider === 'google') {
      assert.equal(calls.google[0].iosClientId, 'ios.apps.googleusercontent.com');
      assert.equal(calls.google[0].webClientId, undefined); // Preserve the backend's iOS audience.
    }
    assert.equal(calls.saved[0].value.user.provider, provider);
  }
});

test('native Apple binds state and nonce and sends a code for server-side exchange', async () => {
  const { load, calls, state } = loadServices({ platform: 'ios' });
  state.payload = { data: session('apple') };
  const credential = await load('social.native').authorizeNative('apple');
  assert.equal(credential.code, 'apple-code');
  assert.equal(credential.accessToken, 'apple-id-token');
  assert.equal(credential.nonce, calls.apple[0].nonce);
  assert.ok(credential.nonce.length >= 32);
  await load('api').signInWithSocial('apple', credential);
  assert.equal(calls.saved.length, 1);
  state.appleResult = { state: 'wrong-state' };
  await assert.rejects(load('social.native').authorizeNative('apple'), /응답/);
  assert.equal(calls.fetch.length, 1);
});

test('cancelling any native provider returns without a server request', async () => {
  for (const provider of ['google', 'kakao', 'apple']) {
    const { load, calls, state } = loadServices({ platform: 'ios' });
    state.googleResult = { type: 'cancelled' };
    state.kakaoError = Object.assign(new Error('ClientFailed(Cancelled): user cancelled'), { code: 'RNKakaoLogins' });
    state.appleError = Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' });
    assert.equal(await load('social.native').authorizeNative(provider), null);
    assert.equal(calls.fetch.length, 0);
    assert.equal(calls.saved.length, 0);
  }
});

test('rejects a social response for a different provider', async () => {
  const { load, state, calls } = loadServices({ platform: 'ios' });
  state.payload = { data: session('kakao') };
  await assert.rejects(load('api').signInWithSocial('google', { accessToken: 'google-token' }));
  assert.equal(calls.saved.length, 0);
});

test('turning retention off removes prior credentials but keeps the running session', async () => {
  for (const platform of ['ios', 'web']) {
    const storage = new Map([['rollpe.session', JSON.stringify(session('apple'))]]);
    const first = loadServices({ platform, storage });
    await first.load('session').saveSession(session(), false);
    assert.equal((await first.load('session').getSession()).user.id, 7);
    assert.equal(storage.has('rollpe.session'), false);
    const relaunched = loadServices({ platform, storage });
    assert.equal(await relaunched.load('session').getSession(), null);
  }
});

test('retained credentials can be restored without storing a password', async () => {
  const storage = new Map();
  const first = loadServices({ platform: 'ios', storage });
  await first.load('session').saveSession(session(), true);
  const relaunched = loadServices({ platform: 'ios', storage });
  assert.equal((await relaunched.load('session').getSession()).refresh, 'api-refresh');
  assert.equal(storage.get('rollpe.session').includes('password'), false);
});

test('iPhone and Android use their configured native providers while web uses a browser', async () => {
  const iphone = loadServices({ platform: 'ios' });
  assert.deepEqual(Array.from(await iphone.load('social.native').availableNativeProviders()), ['google', 'kakao', 'apple']);
  const android = loadServices({ platform: 'android' });
  assert.deepEqual(Array.from(await android.load('social.native').availableNativeProviders()), ['google', 'kakao']);
  const web = loadServices();
  assert.equal((await web.load('social').availableNativeProviders()).length, 0);
});

test('Apple availability failures do not disable native Google or Kakao login', async () => {
  for (const available of [false, 'error']) {
    const { load, state } = loadServices({ platform: 'ios' });
    state.appleAvailable = false;
    if (available === 'error') state.appleAvailabilityError = new Error('Apple is unavailable');
    assert.deepEqual(Array.from(await load('social.native').availableNativeProviders()), ['google', 'kakao']);
    for (const provider of ['google', 'kakao']) {
      state.payload = { data: session(provider) };
      const result = await load('api').signInWithSocial(provider, await load('social.native').authorizeNative(provider));
      assert.equal(result.user.provider, provider);
    }
  }
});

test('Android Google requests an ID token for the web client after checking Play Services', async () => {
  const { load, calls, state } = loadServices({ platform: 'android' });
  state.payload = { data: session('google') };
  await load('api').signInWithSocial('google', await load('social.native').authorizeNative('google'));
  assert.deepEqual({ ...calls.google[0] }, { webClientId: 'web.apps.googleusercontent.com' });
  assert.equal(calls.playServices[0].showPlayServicesUpdateDialog, true);
  assert.equal(JSON.parse(calls.fetch[0][1].body).accessToken, 'google-id-token');
  assert.equal(calls.saved[0].value.user.provider, 'google');
});

test('Android Kakao uses the native access token, and cancelling does not sign in', async () => {
  const { load, calls, state } = loadServices({ platform: 'android' });
  state.payload = { data: session('kakao') };
  await load('api').signInWithSocial('kakao', await load('social.native').authorizeNative('kakao'));
  assert.equal(JSON.parse(calls.fetch[0][1].body).accessToken, 'kakao-access-token');
  state.kakaoError = Object.assign(new Error('ClientError(reason=Cancelled)'), { code: 'RNKakaoLogins' });
  assert.equal(await load('social.native').authorizeNative('kakao'), null);
  assert.equal(calls.fetch.length, 1);
});

test('missing Android Google configuration or Play Services fails before requesting an API session', async () => {
  const missing = loadServices({ platform: 'android', env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '' } });
  assert.deepEqual(Array.from(await missing.load('social.native').availableNativeProviders()), ['kakao']);
  await assert.rejects(missing.load('social.native').authorizeNative('google'));
  assert.equal(missing.calls.google.length, 0);
  const unavailable = loadServices({ platform: 'android' });
  unavailable.state.playServicesError = new Error('unavailable');
  await assert.rejects(unavailable.load('social.native').authorizeNative('google'));
  assert.equal(unavailable.calls.fetch.length, 0);
  await assert.rejects(unavailable.load('social.native').authorizeNative('apple'));
  assert.equal(unavailable.calls.apple.length, 0);
});


test('a pending native storage read cannot restore a session cleared while the read was in flight', async () => {
  const { load, state } = loadServices({ platform: 'ios' });
  let resolveRead;
  state.storageReadPromise = new Promise((resolve) => { resolveRead = resolve; });
  const sessionModule = load('session');
  const reading = sessionModule.getSession();
  await sessionModule.clearSession();
  resolveRead(JSON.stringify(session()));
  assert.equal(await reading, null);
  assert.equal(await sessionModule.getSession(), null);
});

const unverifiedEmail = {
  status_code: 403, message: '이메일 인증을 진행해주세요.', code: 'FORBIDDEN', link: '/login', data: null,
};

test('only a confirmed unverified email login resends verification using PATCH, without saving a session', async () => {
  const { load, calls, state } = loadServices({ platform: 'ios' });
  state.responses = [
    { status: 403, payload: unverifiedEmail },
    { status: 200, payload: { message: '인증 이메일을 재 전송하였습니다.' } },
  ];
  await assert.rejects(load('api').signInWithEmail({ email: ' person@example.com ', password: 'secret', keepSignIn: true }), /인증 메일을 다시 보냈습니다/);
  assert.equal(calls.fetch.length, 2);
  assert.equal(calls.fetch[1][0], 'https://api.example/api/user/verify-email');
  assert.equal(calls.fetch[1][1].method, 'PATCH');
  assert.equal(calls.fetch[1][1].credentials, 'omit');
  assert.deepEqual(JSON.parse(calls.fetch[1][1].body), { email: 'person@example.com', pathCode: 'email' });
  assert.equal(calls.saved.length, 0);
});

test('wrong passwords, generic denials, social login and malformed unverified replies never trigger mail', async () => {
  for (const [status, payload] of [
    [401, unverifiedEmail], [404, unverifiedEmail], [503, unverifiedEmail],
    [403, { ...unverifiedEmail, message: '로그인할 수 없는 계정입니다.' }],
    [403, { ...unverifiedEmail, status_code: 400 }], [403, { ...unverifiedEmail, code: 'OTHER' }],
    [403, { ...unverifiedEmail, link: null }], [403, { ...unverifiedEmail, data: {} }],
  ]) {
    const { load, calls, state } = loadServices({ platform: 'ios' });
    state.responses = [{ status, payload }];
    await assert.rejects(load('api').signInWithEmail({ email: 'a@example.com', password: 'pw', keepSignIn: true }));
    assert.equal(calls.fetch.length, 1);
    assert.equal(calls.saved.length, 0);
  }
  const { load, calls, state } = loadServices({ platform: 'ios' });
  state.responses = [{ status: 403, payload: unverifiedEmail }];
  await assert.rejects(load('api').signInWithSocial('google', { accessToken: 'id-token' }));
  assert.equal(calls.fetch.length, 1);
  assert.equal(calls.saved.length, 0);
});

test('failed verification resend explains the failure and never creates a session', async () => {
  for (const reply of [{ status: 503, payload: { message: '메일 전송 실패' } },
    { error: new Error('offline') }, { status: 200, payload: null },
    { status: 200, jsonError: new SyntaxError('invalid JSON') }]) {
    const { load, calls, state } = loadServices({ platform: 'ios' });
    state.responses = [{ status: 403, payload: unverifiedEmail }, reply];
    await assert.rejects(load('api').signInWithEmail({ email: 'a@example.com', password: 'pw', keepSignIn: true }), /다시 보내지 못했습니다/);
    assert.equal(calls.fetch.length, 2);
    assert.equal(calls.saved.length, 0);
  }
});
