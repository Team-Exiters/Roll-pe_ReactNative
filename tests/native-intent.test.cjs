const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/app/+native-intent.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const validationFilename = path.resolve(__dirname, '../src/utils/reset-link.ts');
const validation = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(validationFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: validation, URL }, { filename: validationFilename });

function loadNativeIntent(apiUrl = 'https://api.example') {
  const exportsObject = {};
  vm.runInNewContext(output, {
    exports: exportsObject, URL, URLSearchParams,
    require: (name) => {
      assert.equal(name, '@/utils/reset-link');
      return validation;
    },
    process: { env: { EXPO_PUBLIC_API_URL: apiUrl, EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'testnativekey' } },
  }, { filename });
  return exportsObject.redirectSystemPath;
}
const redirectSystemPath = loadNativeIntent();

const kakaoReturns = [
  'rollpe:///oauth?code=kakao-authorization-code',
  'rollpe://oauth?code=kakao-authorization-code',
  'reactnativerollpe:///oauth?code=kakao-authorization-code',
  'reactnativerollpe://oauth?code=kakao-authorization-code',
  'kakaotestnativekey://oauth?code=kakao-authorization-code',
  '/oauth?code=kakao-authorization-code',
  'kakaotestnativekey://oauth?error=access_denied&error_description=cancelled',
];

test('returning from Kakao keeps the existing sign-in screen instead of navigating to /oauth', () => {
  for (const path of kakaoReturns) {
    assert.equal(redirectSystemPath({ path, initial: false }), null);
  }
});

test('a Kakao return that launches a closed app opens sign-in without carrying an auth code into the route', () => {
  for (const path of kakaoReturns) {
    assert.equal(redirectSystemPath({ path, initial: true }), '/sign-in');
  }
});

test('ordinary links and other providers keep their own routing and callback handling', () => {
  for (const path of [
    '/sign-in', '/paper/example?code=invitation',
    'rollpe://auth/apple?state=state&code=exchange-code',
    'rollpe://auth/google?state=state&code=exchange-code',
    'rollpe://auth/kakao?state=state&code=exchange-code',
    'reactnativerollpe://auth/apple?state=state&code=exchange-code',
    'reactnativerollpe://auth/google?state=state&code=exchange-code',
    'reactnativerollpe://auth/kakao?state=state&code=exchange-code',
    'com.googleusercontent.apps.test:/oauthredirect?code=google-code',
    'https://example.com/oauth?code=web-code',
    'kakaoanotherapp://oauth?code=other-app-code',
    'rollpe://oauth/other?code=other-code',
    'rollpe://oauth',
    'reactnativerollpe://oauth/other?code=other-code',
    'reactnativerollpe://oauth',
    'http://[invalid',
  ]) {
    for (const initial of [false, true]) {
      assert.equal(redirectSystemPath({ path, initial }), path);
    }
  }
});

const resetToken = 'd04abc-' + 'a'.repeat(32);
const resetUrl = 'https://api.example/api/user/password-reset/Ab123x';
test('verified HTTPS email links map fragment secrets into the internal reset route on warm and cold launch', () => {
  for (const initial of [true, false]) {
    assert.equal(redirectSystemPath({ path: `${resetUrl}#token=${resetToken}`, initial }),
      `/reset-password?identifyCode=Ab123x&token=${resetToken}`);
  }
});

test('malformed or ambiguous matching password links are stripped of secrets and open recovery guidance', () => {
  for (const path of [resetUrl, `${resetUrl}#token=bad`, `${resetUrl}?token=${resetToken}`,
    `${resetUrl}#token=${resetToken}&token=${resetToken}`, `${resetUrl}#token=${resetToken}&extra=x`,
    `${resetUrl}?extra=x#token=${resetToken}`, `${resetUrl}/#token=${resetToken}`,
    `https://api.example/api/user/password-reset/toolong#token=${resetToken}`,
    `https://api.example:8443/api/user/password-reset/Ab123x#token=${resetToken}`,
    `https://attacker@api.example/api/user/password-reset/Ab123x#token=${resetToken}`]) {
    assert.equal(redirectSystemPath({ path, initial: true }), '/reset-password');
  }
});

test('password link rewriting never trusts other domains or schemes', () => {
  for (const path of [
    `https://api.example.evil/api/user/password-reset/Ab123x#token=${resetToken}`,
    `https://evil.example/api/user/password-reset/Ab123x#token=${resetToken}`,
    `http://api.example/api/user/password-reset/Ab123x#token=${resetToken}`,
  ]) assert.equal(redirectSystemPath({ path, initial: false }), path);
});

test('reset links trust only a configured HTTPS root origin and never use a domain fallback', () => {
  for (const apiUrl of ['', 'not-a-url', 'http://api.example', 'https://user@api.example',
    'https://api.example/path', 'https://api.example?query=x', 'https://api.example#fragment',
    'https://api.example:8443', ' https://api.example']) {
    const redirect = loadNativeIntent(apiUrl);
    const path = `${resetUrl}#token=${resetToken}`;
    assert.equal(redirect({ path, initial: true }), path);
    assert.equal(redirect({ path: kakaoReturns[0], initial: false }), null);
  }
  const redirect = loadNativeIntent('https://another.example/');
  assert.equal(redirect({ path: `https://another.example/api/user/password-reset/Ab123x#token=${resetToken}`, initial: true }),
    `/reset-password?identifyCode=Ab123x&token=${resetToken}`);
  const previousOrigin = `${resetUrl}#token=${resetToken}`;
  assert.equal(redirect({ path: previousOrigin, initial: true }), previousOrigin);
});
