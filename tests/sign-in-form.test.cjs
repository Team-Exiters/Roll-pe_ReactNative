const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

test('login fields accept backend email lengths and passwords accepted by password recovery', () => {
  const inputs = [];
  const View = ({ children }) => React.createElement('div', null, children);
  const native = {
    StyleSheet: { create: styles => styles }, View, Text: View,
    TextInput: props => { inputs.push(props); return null; },
  };
  function load(relativePath) {
    const filename = path.resolve(__dirname, '../src', relativePath);
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return native;
      if (name === '@/constants/theme') return { RollpeFonts: {}, useRollpeColors: () => ({}) };
      if (name === '@/components/ui/RoundedBorderTextField') return load('components/ui/RoundedBorderTextField.tsx');
      if (name === '@/components/ui/Checkbox') return { Checkbox: () => null };
      if (name === '@/components/ui/PrimaryButton') return { PrimaryButton: () => null };
      throw new Error(`Unexpected import: ${name}`);
    } }, { filename });
    return exports;
  }
  const { SignInForm } = load('features/sign-in/components/SignInForm.tsx');
  renderToStaticMarkup(React.createElement(SignInForm, { onSubmit() {} }));
  const email = inputs.find(input => input.accessibilityLabel === '이메일');
  const password = inputs.find(input => input.accessibilityLabel === '비밀번호');
  // A reset password or existing email must remain enterable at the next login.
  assert.ok(email.maxLength >= 254, 'backend accepts emails longer than the shared 50-character field default');
  assert.ok(password.maxLength >= 128, 'recovery accepts passwords longer than the shared 50-character field default');
  assert.equal(password.secureTextEntry, true);
});
