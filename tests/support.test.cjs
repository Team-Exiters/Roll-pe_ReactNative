const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function setup(reply) {
  const calls = [];
  class AuthenticationRequiredError extends Error {}
  function load(relative) {
    const exports = {};
    const source = ts.transpileModule(
      fs.readFileSync(path.resolve(__dirname, '../src', relative), 'utf8'),
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      },
    ).outputText;
    vm.runInNewContext(source, {
      exports,
      Error,
      URL,
      require(name) {
        if (name === '@/i18n') return require('./helpers/i18n.cjs');
        if (name === '@/lib/api-response') return require('./helpers/api-response.cjs');
        if (name === '@/utils/rollpe-link') return load('utils/rollpe-link.ts');
        const send = (method, url, body, signal) => {
          calls.push({ method, url, body, signal });
          return reply?.(calls.at(-1));
        };
        if (name === '@/lib/authenticated-api')
          return {
            AuthenticationRequiredError,
            authenticatedPost: (...args) => send('POST', ...args),
          };
        if (name === '@/lib/api')
          return {
            apiUrl: 'https://api.example.test',
            requestJson: (url, body, method, signal) => send(method, url, body, signal),
          };
        throw new Error('Unexpected import: ' + name);
      },
    });
    return exports;
  }
  return {
    api: load('features/support/api.ts'),
    calls,
    AuthenticationRequiredError,
  };
}

const draft = { category: 'bug', content: ' 확인 부탁드립니다. ' };
const id = '12345678-1234-4234-8234-123456789abc';

test('inquiries preserve their retry identity, validate form fields and accept only confirmed receipts', async () => {
  const env = setup(() => ({ response: { status: 201 }, payload: { data: { received: true } } }));
  const signal = new AbortController().signal;
  await env.api.sendInquiry(draft, id, signal);
  assert.equal(env.calls[0].url, '/api/engine/inquiries');
  assert.equal(Object.hasOwn(env.calls[0].body, 'email'), false);
  assert.equal(env.calls[0].body.content, '확인 부탁드립니다.');
  assert.equal(env.calls[0].body.requestId, id);
  assert.equal(env.calls[0].signal, signal);
  for (const changes of [{ category: null }, { content: ' ' }, { content: '가'.repeat(2001) }]) {
    await assert.rejects(env.api.sendInquiry({ ...draft, ...changes }, id));
  }
  assert.equal(env.calls.length, 1);
  for (const response of [
    { response: { status: 201 }, payload: null },
    { response: { status: 200 }, payload: { data: { received: false } } },
    ...[400, 429, 500].map((status) => ({ response: { status } })),
  ])
    await assert.rejects(setup(() => response).api.sendInquiry(draft, id));
});

test('inquiries never silently retry an uncertain submission and preserve authentication errors', async () => {
  const env = setup(() => {
    throw new Error('offline');
  });
  await assert.rejects(env.api.sendInquiry(draft, id));
  assert.equal(env.calls.length, 1);
  const auth = setup(() => {
    throw new auth.AuthenticationRequiredError();
  });
  await assert.rejects(
    auth.api.sendInquiry(draft, id),
    (error) => error instanceof auth.AuthenticationRequiredError,
  );
});
