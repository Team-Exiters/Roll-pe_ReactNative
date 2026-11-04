const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderActions(props) {
  const buttons = [];
  const View = ({ children }) => React.createElement('div', null, children);
  const colors = { rollpe_main: '#EF3C3C' };
  const native = {
    StyleSheet: { create: value => value },
    View, Text: View,
    Pressable: props => { buttons.push(props); return React.createElement(View, null, props.children); },
  };
  function load(file) {
    const filename = path.resolve(__dirname, '../src', file);
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require: name => {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return native;
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/constants/theme') return { RollpeFonts: { semibold: 'semibold' }, useRollpeColors: () => colors };
      if (name === 'expo-image') return { Image: () => null };
      if (name.startsWith('@/assets/')) return 1;
      if (name === '@/components/ui/PrimaryButton') return { PrimaryButton: props => { buttons.push(props); return null; } };
      if (name === '@/components/ui/OutlineButton') return load('components/ui/OutlineButton.tsx');
      throw new Error(`Unexpected dependency ${name}`);
    } }, { filename });
    return exports;
  }
  const { RollpeInfoActions } = load('features/rollpe-info/components/RollpeInfoActions.tsx');
  renderToStaticMarkup(React.createElement(RollpeInfoActions, { disabled: false, canSaveImage: true, ...props }));
  return buttons;
}

test('detail actions preserve host, participant and recipient permissions', () => {
  const callbacks = Object.fromEntries(['Manage', 'Share', 'Leave', 'Report', 'SaveImage'].map(action => [`on${action}`, () => {}]));
  for (const [role, actions] of [['host', ['Manage', 'Share']], ['participant', ['Leave', 'Report']], ['receiver', ['SaveImage']]]) {
    const buttons = renderActions({ role, ...callbacks });
    assert.deepEqual(buttons.map(button => button.onPress), actions.map(action => callbacks[`on${action}`]));
  }
  for (const role of [null, 'unavailable']) assert.equal(renderActions({ role, ...callbacks }).length, 0);
});

test('detail actions stay disabled during requests and until the image is ready', () => {
  for (const role of ['host', 'participant']) {
    assert.ok(renderActions({ role, disabled: true }).every(button => button.disabled));
  }
  assert.equal(renderActions({ role: 'receiver', canSaveImage: false })[0].disabled, true);
  assert.equal(renderActions({ role: 'receiver', canSaveImage: true })[0].disabled, false);
});

test('shared outline buttons preserve spacing, fonts and pressed or disabled feedback', () => {
  const enabled = renderActions({ role: 'host' })[0];
  const flatten = styles => Object.assign({}, ...styles);
  assert.equal(flatten(enabled.style({ pressed: false })).padding, 14);
  assert.equal(flatten(enabled.style({ pressed: false })).borderWidth, 2);
  assert.equal(flatten(enabled.style({ pressed: false })).opacity, 1);
  assert.equal(flatten(enabled.style({ pressed: true })).opacity, 0.7);
  assert.equal(flatten(enabled.children.props.style).fontFamily, 'semibold');
  const disabled = renderActions({ role: 'participant', disabled: true })[0];
  assert.equal(disabled.accessibilityState.disabled, true);
  assert.equal(flatten(disabled.style({ pressed: true })).opacity, 0.5);
});
