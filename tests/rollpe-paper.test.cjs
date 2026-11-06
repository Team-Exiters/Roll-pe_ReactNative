const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const exportsObject = {};
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/components/rollpe/RollpePaper.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(source, { exports: exportsObject, require: name => {
  if (name === 'react' || name === 'react/jsx-runtime') return require(name);
  if (name === '@/i18n') return require('./helpers/i18n.cjs');
  if (name === 'expo-font') return { useFonts: () => [true, null] };
  if (name === 'expo-image') return { Image: () => null };
  if (name.startsWith('@/assets/')) return 1;
  if (name === 'react-native') return { StyleSheet: { create: value => value, absoluteFill: {} },
    View: ({ children }) => React.createElement('div', null, children),
    Text: ({ children }) => React.createElement('span', null, children), ActivityIndicator: () => null };
  throw new Error(`Unexpected dependency ${name}`);
} });
const { RollpePaper } = exportsObject;
const render = props => renderToStaticMarkup(React.createElement(RollpePaper, { title: '축하해요', theme: '화이트', ratio: '가로', size: 'A4', width: 842, ...props }));

test('real papers render server messages and authors without ever substituting creation samples', () => {
  const empty = render({ messages: [] });
  assert.doesNotMatch(empty, /테스트\d|가나다라마바사/);
  const real = render({ messages: [{ index: 2, content: '우리의 소중한 추억', author: { name: '작성자' }, color: '#FFB9B9' }] });
  assert.match(real, /우리의 소중한 추억\n- 작성자/);
  assert.doesNotMatch(real, /테스트\d|가나다라마바사/);
});

test('creation samples remain available across all six original layouts', () => {
  for (const ratio of ['가로', '세로']) for (const theme of ['화이트', '추모', '축하']) {
    const html = render({ ratio, theme, sample: true });
    assert.match(html, /테스트12/);
    assert.match(html, /축하해요/);
  }
});

test('blocked memo bodies and authors never appear in paper previews or exported paper markup', () => {
  const html = render({ messages: [{ index: 2, content: '숨겨야 하는 내용', author: { name: '차단 대상 이름' }, color: '#EEEEEE', hidden: true }] });
  assert.doesNotMatch(html, /숨겨야 하는 내용|차단 대상 이름/);
  assert.match(html, /차단한 사용자의 마음/);
});
