const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { attachAxiosTransport } = require('./helpers/axios-transport.cjs');

const values = {
  email: 'person@example.com', name: '테스트', password: 'abcd123!', confirmPassword: 'abcd123!',
  ageChecked: true, termsChecked: true, privacyChecked: true,
};

function signUpService({ status = 201, payload = { message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.' }, failure, timeout = false, bodyTimeout = false, jsonFailure } = {}) {
  const requests = [];
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const filename = name === 'shared-api'
      ? path.resolve(__dirname, '../src/lib/api.ts')
      : path.resolve(__dirname, `../src/features/sign-up/${name}.ts`);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    modules.set(name, exports);
    let network;
    vm.runInNewContext(output, {
      exports, AbortController, Error,
      process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example' } },
      setTimeout: (fn, ms) => setTimeout(fn, timeout || bodyTimeout ? 1 : ms), clearTimeout,
      fetch: network = async (url, options) => {
        requests.push([url, options]);
        if (failure) throw failure;
        if (timeout) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
        return { ok: status >= 200 && status < 300, status, json: async () => {
          if (jsonFailure) throw jsonFailure;
          if (bodyTimeout) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('body timeout'))));
          return payload;
        } };
      },
      require: (name) => {
        if (name === 'axios') return require('axios');
        if (name === 'react-native') return { Platform: { OS: 'web' } };
        if (name === '@/lib/api') return load('shared-api');
        if (name === '@/features/sign-up/validation') return load('validation');
        throw new Error(`Unexpected import: ${name}`); // No storage or token state dependency.
      },
    }, { filename });
    if (name === 'shared-api') attachAxiosTransport(exports.apiClient, network);
    return exports;
  }
  return { requests, api: load('api'), validation: load('validation') };
}

test('sign-up requires original email, nickname, password, confirmation and all three agreements', async () => {
  const { api, validation, requests } = signUpService();
  assert.equal(validation.canSignUp(values), true);
  for (const change of [
    { email: 'bad' }, { email: ' space@example.com' }, { email: 'a'.repeat(40) + '@example.com' },
    { name: '김' }, { name: '1234567' }, { password: 'short', confirmPassword: 'short' },
    { password: 'abcd1234', confirmPassword: 'abcd1234' }, { confirmPassword: 'different' },
    { ageChecked: false }, { termsChecked: false }, { privacyChecked: false },
  ]) {
    assert.equal(validation.canSignUp({ ...values, ...change }), false);
    await assert.rejects(api.signUp({ ...values, ...change }));
  }
  assert.equal(requests.length, 0);
});

test('original any-letter password policy is preserved and boundary whitespace is explicitly rejected before sending', async () => {
  const { api, validation, requests } = signUpService();
  assert.equal(validation.canSignUp({ ...values, password: 'ABCD123!', confirmPassword: 'ABCD123!' }), true);
  for (const password of [' abcd123!', 'abcd123! ']) {
    const form = { ...values, password, confirmPassword: password };
    assert.equal(validation.canSignUp(form), true); // Original button validation; submitting shows the explanatory alert.
    await assert.rejects(api.signUp(form), /비밀번호 앞뒤에 공백/);
  }
  assert.equal(requests.length, 0);
});

test('sign-up sends only the original three fields anonymously and returns the verification notice without tokens', async () => {
  const { api, requests } = signUpService();
  assert.match(await api.signUp(values), /이메일을 확인/);
  assert.equal(requests[0][0], 'https://api.example/api/user/signup');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(requests[0][1].credentials, 'omit');
  assert.equal(requests[0][1].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requests[0][1].body), { email: values.email, name: values.name, password: values.password });
});

test('inactive duplicate accounts keep the server error and point to the existing login resend entry', async () => {
  const { api, requests } = signUpService({ status: 400, payload: { message: '이미 가입된 이메일입니다.' } });
  await assert.rejects(api.signUp(values), /이미 가입된 이메일입니다.[\s\S]*로그인 화면/);
  assert.equal(requests.length, 1); // No second signup or unsolicited resend.
});

test('serializer field errors are readable and unknown malformed replies have a safe fallback', async () => {
  const { api } = signUpService({ status: 400, payload: { message: { email: ['유효한 이메일이 필요합니다.'], name: ['이름을 확인해주세요.'] } } });
  await assert.rejects(api.signUp(values), /유효한 이메일이 필요합니다.\n이름을 확인해주세요./);
  for (const payload of [null, [], { message: { unknown: { nested: 'not a string' } } }]) {
    await assert.rejects(signUpService({ status: 400, payload }).api.signUp(values), /회원가입에 실패/);
  }
});

test('network, timeout, SMTP and malformed success responses never report successful signup', async () => {
  for (const options of [{ failure: new Error('offline') }, { timeout: true },
    { status: 503, payload: { message: '이메일 전송에 실패했습니다.' } }, { payload: null },
    { jsonFailure: new SyntaxError('invalid JSON') }, { bodyTimeout: true }]) {
    await assert.rejects(signUpService(options).api.signUp(values),
      options.jsonFailure || options.bodyTimeout ? /회원가입 서버에 연결하지 못했습니다/ : undefined);
  }
});
