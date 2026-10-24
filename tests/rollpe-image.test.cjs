const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ granted = true, saveError } = {}) {
  const calls = [];
  const exportsObject = {};
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/features/rollpe-info/save-image.native.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports: exportsObject, Error, require: name => {
    if (name === '@/i18n') return require('./helpers/i18n.cjs');
    if (name === 'expo-media-library/legacy') return {
      requestPermissionsAsync: async (...args) => { calls.push(['permission', ...args]); return { granted }; },
      saveToLibraryAsync: async uri => { calls.push(['save', uri]); if (saveError) throw saveError; },
    };
    if (name === 'react-native-view-shot') return {
      captureRef: async node => { calls.push(['capture', node]); return 'file:///test-only-paper.png'; },
      releaseCapture: uri => calls.push(['release', uri]),
    };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return { save: exportsObject.saveRollpeImage, calls };
}
test('image saving requests add-only permission, then captures, saves and releases the temporary image', async () => {
  const { save, calls } = setup();
  const node = { nodeType: 1 };
  await save(node, 'paper');
  assert.deepEqual(Array.from(calls[0].slice(0, 2)), ['permission', true]);
  assert.equal(calls[0][2].length, 0);
  assert.deepEqual(calls.map(call => call[0]), ['permission', 'capture', 'save', 'release']);
});
test('denied permission produces no capture or saved image, and failed saving still releases the private temporary image', async () => {
  const denied = setup({ granted: false });
  await assert.rejects(denied.save({ nodeType: 1 }, 'paper'), /사진 접근 권한/);
  assert.deepEqual(denied.calls.map(call => call[0]), ['permission']);
  const failed = setup({ saveError: new Error('save failure') });
  await assert.rejects(failed.save({ nodeType: 1 }, 'paper'), /save failure/);
  assert.equal(failed.calls.at(-1)[0], 'release');
});
