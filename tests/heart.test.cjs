const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = '12345678-1234-4234-8234-123456789abc';
function setup(reply = () => ({ response: { status: 201 }, payload: { data: { id: 9, code } } })) {
  const modules = new Map(), calls = [];
  class AuthenticationRequiredError extends Error {}
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {}; modules.set(name, exports);
    const file = path.resolve(__dirname, '../src', name === 'link' ? 'utils/rollpe-link.ts' : `features/rollpe-content/${name}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    } }).outputText, { exports, Error, URLSearchParams, Set, require: name => {
      if (name === '@/i18n') return require('./helpers/i18n.cjs');
      if (name === '@/utils/rollpe-link') return load('link');
      if (name === '@/features/rollpe-content/model') return load('model');
      if (name === '@/lib/authenticated-api') {
        const send = method => async (url, body, signal) => {
          if (method === 'GET') { signal = body; body = undefined; }
          const call = { method, url, body, signal }; calls.push(call); return reply(call);
        };
        return { AuthenticationRequiredError, authenticatedGet: send('GET'), authenticatedPost: send('POST'),
          authenticatedPatch: send('PATCH'), authenticatedDelete: send('DELETE') };
      }
      throw Error(`Unexpected dependency ${name}`);
    } });
    return exports;
  }
  return { api: load('api'), model: load('model'), calls, AuthenticationRequiredError };
}
const draft = { content: '생일 축하해요!', color: '#F2EB28' };

test('writing and editing preserve original API fields, index, color and cancellation', async () => {
  for (const heartId of [undefined, 9]) {
    const env = setup(() => ({ response: { status: heartId ? 200 : 201 }, payload: { data: { id: 9, code } } }));
    const signal = new AbortController().signal;
    await env.api.saveHeart(3, 2, draft, heartId, signal);
    const call = env.calls[0];
    assert.equal(call.url, '/api/heart');
    assert.equal(call.method, heartId ? 'PATCH' : 'POST');
    assert.equal(call.signal, signal);
    assert.deepEqual(JSON.parse(JSON.stringify(call.body)), { paperFK: 3, location: 2, context: draft.content,
      color: 'F2EB28', ...(heartId ? { heartPK: 9 } : {}) });
  }
});

test('deletion sends a normalized UUID and no mutation body', async () => {
  const { api, calls } = setup(() => ({ response: { status: 204 }, payload: null }));
  const signal = new AbortController().signal;
  await api.deleteHeart(code.replaceAll('-', '').toUpperCase(), signal);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, `/api/heart?hcode=${code}`);
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].signal, signal);
});

test('blank or oversized contents, newlines, invalid colors and positions never reach the server', async () => {
  const { api, model, calls } = setup();
  for (const bad of [{ content: '' }, { content: '  ' }, { content: '가'.repeat(41) }, { content: '가\n나' },
    { color: '' }, { color: 'url(unsafe)' }]) await assert.rejects(api.saveHeart(3, 2, { ...draft, ...bad }));
  for (const index of [-1, 12, 1.5]) await assert.rejects(api.saveHeart(3, index, draft));
  await assert.rejects(api.saveHeart(0, 2, draft));
  await assert.rejects(api.saveHeart(3, 2, draft, 0));
  await assert.rejects(api.deleteHeart('not-a-uuid'));
  assert.equal(calls.length, 0);
  assert.equal(model.cleanHeartContent('가\r\n나'), '가나');
  assert.equal(Array.from(model.cleanHeartContent('😀'.repeat(41))).length, 40);
  assert.equal(model.heartDraftError({ content: '가'.repeat(40), color: '#f2eb28' }), null);
});

test('colors come from the theme-specific original index and use the exact server values', async () => {
  for (const mono of [false, true]) {
    const env = setup(() => ({ response: { ok: true }, payload: { data: [{ id: 4, type: mono ? 'MONOCOLOR' : 'COLOR', name: 'f2eb28' }] } }));
    const list = await env.api.fetchHeartColors(mono);
    assert.equal(env.calls[0].url, `/api/index?type=${mono ? 'monocolor' : 'color'}`);
    assert.equal(list[0].name, 'f2eb28');
    assert.equal(list[0].value, '#F2EB28');
  }
  for (const data of [[], null, [{ id: 1, type: 'SIZE', name: 'FFFFFF' }], [{ id: 1, type: 'COLOR', name: 'bad' }]]) {
    await assert.rejects(setup(() => ({ response: { ok: true }, payload: { data } })).api.fetchHeartColors(false));
  }
});

test('conflicts, expiration and permissions require a refresh without claiming success', async () => {
  for (const status of [404, 470, 471, 481, 482, 483, 485]) {
    const env = setup(() => ({ response: { status }, payload: {} }));
    await assert.rejects(env.api.saveHeart(3, 2, draft), error => error instanceof env.api.HeartMutationError && error.reload);
    assert.equal(env.calls.length, 1);
  }
  await assert.rejects(setup(() => ({ response: { status: 480 }, payload: { message: '검증 오류' } })).api.saveHeart(3, 2, draft), /검증 오류/);
});

test('a legacy direct write refused at capacity shows the full notice and refreshes without retry', async () => {
  const state = setup(() => ({ response: { status: 409 }, payload: { data: { reason: 'full' } } }));
  await assert.rejects(state.api.saveHeart(3, 2, draft), error => error instanceof state.api.HeartMutationError && error.reload
    && error.message === '참여 정원이 가득 찼습니다.\n자리가 생긴 후 다시 시도해주세요.');
  assert.equal(state.calls.length, 1);
});

test('uncertain mutation results are never retried and malformed success never claims completion', async () => {
  for (const reply of [() => { throw new Error('offline'); }, () => ({ response: { status: 201 }, payload: null })]) {
    const env = setup(reply);
    await assert.rejects(env.api.saveHeart(3, 2, draft), error => error.reload && /처리 결과/.test(error.message));
    assert.equal(env.calls.length, 1);
  }
  const env = setup(() => { throw new env.AuthenticationRequiredError('signed out'); });
  await assert.rejects(env.api.saveHeart(3, 2, draft), error => error instanceof env.AuthenticationRequiredError);
  const controller = new AbortController(); controller.abort();
  const cause = new Error('cancelled');
  await assert.rejects(setup(() => { throw cause; }).api.saveHeart(3, 2, draft, undefined, controller.signal), error => error === cause);
});

test('heart report URLs preserve encoded identifiers and reject untrusted codes', () => {
  const { model } = setup();
  const url = new URL(model.reportHeartUrl(code, code, 'User&next=bad'));
  assert.equal(url.searchParams.get('entry.44205633'), '부적절한 마음');
  assert.equal(url.searchParams.get('entry.1614951501'), code);
  assert.equal(url.searchParams.get('entry.2107714088'), 'User&next=bad');
  assert.throws(() => model.reportHeartUrl('bad', code, 'User01'));
});
