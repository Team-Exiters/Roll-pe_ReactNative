const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(respond = async () => { throw Error('unexpected network'); }, base = 'https://api.example') {
  const { attachAxiosTransport } = require('./helpers/axios-transport.cjs');
  function evaluate(filename, dependencies) {
    const exports = {};
    const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, require: dependencies, URL, AbortController, setTimeout, clearTimeout,
        process: { env: { EXPO_PUBLIC_API_URL: base } }, Error });
    return exports;
  }
  const common = evaluate('../src/lib/api.ts', name => {
    if (name === 'axios') return require('axios');
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    throw Error(`Unexpected dependency ${name}`);
  });
  attachAxiosTransport(common.apiClient, async (url, options, request) => {
    const result = await respond(url, options, request);
    return { status: result.status ?? (result.ok ? 200 : 400), json: result.json };
  });
  return evaluate('../src/features/policy/content.ts', name => {
    assert.equal(name, '../../lib/api');
    return common;
  });
}

test('only exact scalar policy types and safe API origins are accepted', () => {
  const service = load();
  for (const value of [undefined, null, ['terms'], 'TERMS', 'privacy?docs=terms', '']) assert.equal(service.policyType(value), null);
  assert.equal(service.policyType('privacy'), 'privacy');
  assert.equal(service.policyEndpoint('https://api.example/', 'terms'), 'https://api.example/api/user/docs?docs=terms');
  assert.equal(service.policyEndpoint('http://localhost:8081', 'privacy'), 'http://localhost:8081/api/user/docs?docs=privacy');
  for (const base of ['http://api.example', 'javascript:alert(1)', 'https://name:password@api.example', 'https://api.example/path', 'https://api.example?x=1', undefined]) {
    assert.throws(() => service.policyEndpoint(base, 'terms'));
  }
  assert.throws(() => service.policyEndpoint('https://api.example', 'unknown'));
});

test('text, entities, block order and list items survive without executing remote HTML', () => {
  const blocks = load().policyBlocks('<h2>제목 &amp; 소개</h2><p>원문 &#54620; &#xAE00; &lt;b&gt;</p><ul><li>첫째</li><li>둘째</li></ul><script>alert(1)</script><style>bad</style><a onclick="bad()" href="https://evil">링크 문구</a><img onerror="bad()">');
  assert.deepEqual(JSON.parse(JSON.stringify(blocks)), [
    { kind: 'h2', text: '제목 & 소개' }, { kind: 'p', text: '원문 한 글 <b>' },
    { kind: 'li', text: '첫째' }, { kind: 'li', text: '둘째' }, { kind: 'p', text: '링크 문구' },
  ]);
  assert.equal(load().policyBlocks('<script>unclosed').length, 0);
});

test('both actual backend documents preserve every text character and paragraph in source order', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../roll-pe-api/rollpe/utils/functions.py'), 'utf8');
  for (const name of ['PRIVACY', 'TERMS']) {
    const html = new RegExp(name + '=\\"\\"\\"([^]*?)\\"\\"\\"').exec(source)?.[1];
    assert.ok(html, `${name} source exists`);
    const blocks = load().policyBlocks(html);
    const expected = html.replace(/<[^>]*>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s/g, '');
    assert.equal(blocks.map(block => block.text).join('').replace(/\s/g, ''), expected);
    const kinds = [...html.matchAll(/<(h2|h3|p|li)>/g)].map(match => match[1]);
    assert.deepEqual(Array.from(blocks, block => block.kind), kinds);
  }
});

test('policy request sends no credentials and propagates caller cancellation', async () => {
  const controller = new AbortController();
  const service = load(async (url, options) => {
    assert.equal(url, 'https://api.example/api/user/docs?docs=privacy');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.signal.aborted, false);
    assert.equal(options.method, 'GET');
    return { ok: true, json: async () => ({ data: '<p>본문</p>' }) };
  });
  assert.equal((await service.fetchPolicy('privacy', controller.signal))[0].text, '본문');
  for (const payload of [{}, { data: 123 }, { data: '<script>only script</script>' }]) {
    await assert.rejects(load(async () => ({ ok: true, json: async () => payload })).fetchPolicy('terms', controller.signal));
  }
  await assert.rejects(load(async () => ({ ok: false, json: async () => ({ data: '<p>error</p>' }) })).fetchPolicy('terms', controller.signal));
});

test('HTML block margins collapse and explicit line breaks remain line breaks', () => {
  const service = load();
  const blocks = service.policyBlocks('<p>첫째<br>둘째</p><p>문단</p><h3>제목</h3><p>본문</p><ul><li>하나</li><li>둘</li></ul>');
  assert.equal(blocks[0].text, '첫째\n둘째');
  assert.equal(service.policySpacing(blocks, 0).marginTop, 20);
  assert.equal(service.policySpacing(blocks, 1).marginTop, 20);
  assert.equal(service.policySpacing(blocks, 2).marginTop, 23.4);
  assert.equal(service.policySpacing(blocks, 3).marginTop, 23.4);
  assert.equal(service.policySpacing(blocks, 5).marginTop, 0);
  assert.equal(service.policySpacing(blocks, 5).marginBottom, 20);
});


test('policy requests cancel through the real Axios adapter', async () => {
  const controller = new AbortController();
  const service = load(async (_url, options) => {
    controller.abort();
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  });
  await assert.rejects(service.fetchPolicy('terms', controller.signal));
});

test('strict Axios JSON parsing rejects malformed wire responses', async () => {
  const service = load(async () => ({ status: 200, json: async () => { throw Error('invalid JSON'); } }));
  await assert.rejects(service.fetchPolicy('terms', new AbortController().signal));
});

test('already-aborted policy requests never reach the network boundary', async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  const service = load(async () => { requests += 1; return { status: 200, json: async () => ({ data: '<p>본문</p>' }) }; });
  await assert.rejects(service.fetchPolicy('terms', controller.signal));
  assert.equal(requests, 0);
});
