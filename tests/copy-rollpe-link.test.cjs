const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';

function setup(write = async () => true, apiUrl) {
  const calls = [], cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const filename = path.resolve(__dirname, '../src', `${file}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Date, Error, URL, Set,
      process: { env: { EXPO_PUBLIC_API_URL: apiUrl } }, require: name => {
      if (name === 'expo-clipboard') return { setStringAsync: async value => { calls.push(value); return write(value); } };
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      return load(name.slice(2));
    } }, { filename });
    return exports;
  }
  return { ...load('features/rollpe-info/copy-link'), calls };
}

test('copying a share link writes only the normalized paper URL to the platform clipboard', async () => {
  const { copyRollpeLink, calls } = setup();
  await copyRollpeLink(code.replaceAll('-', '').toUpperCase(), 'https://web.example');
  assert.deepEqual(calls, [`https://web.example/rollpe/${code}`]);
});

test('without a public HTTPS deployment copying preserves the registered app scheme', async () => {
  for (const website of [undefined, 'http://localhost:8083', 'https://user:password@web.example', 'https://web.example?token=secret']) {
    const { copyRollpeLink, calls } = setup();
    await copyRollpeLink(code, website);
    assert.deepEqual(calls, [`rollpe://rollpe/${code}`]);
  }
});

test('a configured API provides a browsable HTTPS invitation when no web deployment exists', async () => {
  for (const website of [undefined, 'http://localhost:8083']) {
    const { copyRollpeLink, calls } = setup(undefined, 'https://api.example');
    await copyRollpeLink(code, website);
    assert.deepEqual(calls, [`https://api.example/rollpe/${code}`]);
  }
});

test('denied and rejected clipboard writes report failure without silently retrying', async () => {
  for (const write of [async () => false, async () => { throw new Error('clipboard denied'); }]) {
    const { copyRollpeLink, calls } = setup(write);
    await assert.rejects(copyRollpeLink(code), { message: '링크를 복사하지 못했습니다. 다시 시도해주세요.' });
    assert.equal(calls.length, 1);
  }
});

test('invalid paper codes are rejected before overwriting the clipboard', async () => {
  const { copyRollpeLink, calls } = setup();
  for (const value of ['', '../paper', `${code}?token=secret`]) await assert.rejects(copyRollpeLink(value));
  assert.equal(calls.length, 0);
});
