const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real translator and bundled copy in service tests, without native modules.
const filename = path.resolve(__dirname, '../../src/i18n/index.ts');
const exportsObject = {};
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
vm.runInNewContext(output, {
  exports: exportsObject,
  require: name => name.startsWith('@/i18n/locales/')
    ? require(path.resolve(__dirname, '../../src/i18n/locales', path.basename(name))) : require(name),
}, { filename });
module.exports = exportsObject;
