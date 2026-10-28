const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../app.config.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function config(apiUrl, webUrl, previous = {}) {
  const exports = {};
  vm.runInNewContext(output, {
    exports, URL, Map, Set,
    process: { env: { EXPO_PUBLIC_API_URL: apiUrl, EXPO_PUBLIC_WEB_URL: webUrl } },
    require: name => {
      assert.equal(name, './src/i18n/locales/ko.json');
      return require('../src/i18n/locales/ko.json');
    },
  }, { filename });
  return JSON.parse(JSON.stringify(exports.default({ config: previous })));
}

test('native association covers invitations on API and web domains and preserves password reset', () => {
  const value = config('https://api.example', 'https://web.example');
  assert.deepEqual(value.ios.associatedDomains, ['applinks:api.example', 'applinks:web.example']);
  assert.deepEqual(value.android.intentFilters, [
    { action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'], data: [
      { scheme: 'https', host: 'api.example', pathPrefix: '/api/user/password-reset/' },
      { scheme: 'https', host: 'api.example', pathPrefix: '/rollpe/' },
    ] },
    { action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'], data: [
      { scheme: 'https', host: 'web.example', pathPrefix: '/rollpe/' },
    ] },
  ]);
});

test('a shared API and web domain is deduplicated without replacing existing native settings', () => {
  const existing = { action: 'VIEW', data: [{ scheme: 'another' }] };
  const value = config('https://api.example/', 'https://api.example', {
    scheme: 'rollpe', ios: { bundleIdentifier: 'dev.hugesilver.Roll-Pe', associatedDomains: ['applinks:api.example'] },
    android: { package: 'dev.hugesilver.RollPe', intentFilters: [existing] },
  });
  assert.equal(value.scheme, 'rollpe');
  assert.equal(value.ios.bundleIdentifier, 'dev.hugesilver.Roll-Pe');
  assert.equal(value.android.package, 'dev.hugesilver.RollPe');
  assert.deepEqual(value.ios.associatedDomains, ['applinks:api.example']);
  assert.equal(value.android.intentFilters.length, 2);
  assert.deepEqual(value.android.intentFilters[0], existing);
  assert.equal(value.android.intentFilters[1].data.length, 2);
});

test('missing, local or malformed domains never add a hardcoded association', () => {
  for (const value of [undefined, '', 'bad', 'http://api.example', 'https://user@api.example',
    'https://api.example/path', 'https://api.example:8443', 'https://api.example?x=1',
    'https://api.example#fragment', ' https://api.example', 'https://localhost', 'https://127.0.0.1']) {
    const result = config(value, value);
    assert.equal(result.ios.associatedDomains, undefined);
    assert.equal(result.android.intentFilters, undefined);
  }
});
