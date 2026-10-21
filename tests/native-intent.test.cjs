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

const exportsObject = {};
vm.runInNewContext(output, {
  exports: exportsObject, URL, URLSearchParams,
  process: { env: { EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'testnativekey' } },
}, { filename });
const { redirectSystemPath } = exportsObject;

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
