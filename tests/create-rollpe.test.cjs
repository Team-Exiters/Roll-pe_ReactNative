const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const now = new Date(2026, 9, 23, 12);
class FixedDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(now); }
}
class AuthenticationRequiredError extends Error {}
const choice = (id, type, name) => ({ id, type, name, is_vip: false, query: type === 'SIZE' ? { max: 12 } : {} });
const ratio = choice(21, 'RATIO', '가로');
const theme = choice(34, 'THEME', '축하');
const size = choice(55, 'SIZE', 'A4');
const recipient = { id: 7, name: '수신자', identifyCode: 'Ab123x' };
const valid = { title: '축하해요', ratio, theme, size, recipient, isPrivate: true, password: 'paper-password', receivingDate: '2026-10-24' };
const success = data => ({ response: { ok: true, status: 200 }, payload: { data } });
function setup(respond) {
  const calls = [];
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    const filename = path.resolve(__dirname, `../src/features/create-rollpe/${name}.ts`);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { exports, Date: FixedDate, Error, URLSearchParams,
      require: name => {
        if (name === '@/i18n') return require('./helpers/i18n.cjs');
        if (name === '@/lib/api-response') return require('./helpers/api-response.cjs');
        if (name === '@/features/create-rollpe/validation') return load('validation');
        assert.equal(name, '@/lib/authenticated-api');
        return {
          AuthenticationRequiredError,
          authenticatedGet: async (url, signal) => { calls.push({ method: 'GET', url, signal }); return respond(calls.at(-1)); },
          authenticatedPost: async (url, body, signal) => { calls.push({ method: 'POST', url, body, signal }); return respond(calls.at(-1)); },
        };
      },
    }, { filename });
    modules.set(name, exports);
    return exports;
  }
  return { api: load('api'), validation: load('validation'), calls };
}

test('creation choices use original index API and server IDs, grouping choices without inventing defaults', async () => {
  const signal = new AbortController().signal;
  const { api, calls } = setup(() => success([theme, { type: 'COLOR' }, size, ratio]));
  const options = await api.fetchRollpeOptions(signal);
  assert.equal(calls[0].url, '/api/index?type=all');
  assert.equal(calls[0].signal, signal);
  assert.equal(options.ratios[0].id, 21);
  assert.equal(options.themes[0].id, 34);
  assert.equal(options.sizes[0].query.max, 12);
});

test('missing option groups and malformed option data do not become a usable form', async () => {
  for (const data of [null, [], [ratio, theme], [ratio, theme, { ...size, query: { max: '12' } }],
    [{ ...ratio, id: 0 }, theme, size]]) {
    await assert.rejects(setup(() => success(data)).api.fetchRollpeOptions());
  }
});

test('recipient search encodes the entire keyword and forwards cancellation; no results is an empty list', async () => {
  const signal = new AbortController().signal;
  const { api, calls } = setup(() => success({ results: [recipient] }));
  assert.equal((await api.searchRecipients(' 이름 /..?&page=9 ', signal))[0].id, recipient.id);
  const url = new URL(calls[0].url, 'https://api.example');
  assert.equal(url.pathname, '/api/user/search-user/');
  assert.equal(url.searchParams.get('nameCode'), '이름 /..?&page=9');
  assert.equal(url.searchParams.has('page'), false);
  assert.equal(calls[0].signal, signal);
  assert.equal((await setup(() => ({ response: { status: 404 }, payload: null })).api.searchRecipients('none')).length, 0);
  await assert.rejects(api.searchRecipients(' '));
  assert.equal(calls.length, 1);
  await assert.rejects(setup(() => success({ results: [{ ...recipient, id: '7' }] })).api.searchRecipients('name'));
});

test('creation validates all selections, original title/password limits, and public/private password rules', () => {
  const { creationError } = setup().validation;
  assert.equal(creationError(valid), null);
  assert.equal(creationError({ ...valid, isPrivate: false, password: '' }), null);
  for (const values of [
    { ...valid, title: '' }, { ...valid, title: 'a'.repeat(21) }, { ...valid, ratio: null },
    { ...valid, theme: null }, { ...valid, size: null }, { ...valid, ratio: theme },
    { ...valid, ratio: { ...ratio, id: -1 } }, { ...valid, password: '' },
    { ...valid, password: 'a'.repeat(51) }, { ...valid, recipient: null },
  ]) assert.equal(typeof creationError(values), 'string');
});

test('receiving date is local calendar tomorrow through day 30 across month/year boundaries', () => {
  const { receivingDateLimits, isReceivingDate } = setup().validation;
  const december = new Date(2026, 11, 31, 23, 59);
  const limits = receivingDateLimits(december);
  assert.equal(limits.minimum, '2027-01-01');
  assert.equal(limits.maximum, '2027-01-30');
  assert.equal(isReceivingDate('2027-01-01', december), true);
  assert.equal(isReceivingDate('2027-01-30', december), true);
  for (const date of ['2026-12-31', '2027-01-31', '2027-02-30', '2027-1-01']) assert.equal(isReceivingDate(date, december), false);
  assert.equal(receivingDateLimits(new Date(2028, 1, 28)).minimum, '2028-02-29');
});

const created = () => ({ response: { ok: true, status: 201 }, payload: {
  message: '생성되었습니다.', data: { title: valid.title, receivingDate: valid.receivingDate },
} });
test('private creation sends the original endpoint and minimal fields without client-selected host or privileges', async () => {
  const { api, calls } = setup(created);
  const signal = new AbortController().signal;
  assert.equal(await api.createRollpe(valid, signal), '생성되었습니다.');
  assert.equal(calls[0].url, '/api/paper');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].signal, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), {
    receiverFK: 7, receivingDate: '2026-10-24', title: '축하해요', description: '',
    themeFK: 34, sizeFK: 55, ratioFK: 21, password: 'paper-password',
  });
  await assert.rejects(api.createRollpe({ ...valid, title: '' }));
  assert.equal(calls.length, 1);
});

test('switching to public omits an old private password from the request', async () => {
  const { api, calls } = setup(created);
  await api.createRollpe({ ...valid, isPrivate: false });
  assert.equal(Object.hasOwn(calls[0].body, 'password'), false);
});

test('server field errors remain readable, while ambiguous network/success responses never retry POST or report success', async () => {
  const denied = setup(() => ({ response: { ok: false, status: 400 }, payload: { data: { title: ['제목 오류'] } } }));
  await assert.rejects(denied.api.createRollpe(valid), /제목 오류/);
  for (const reply of [new Error('network'), { response: { ok: false, status: 503 }, payload: null },
    { response: { ok: true, status: 201 }, payload: { data: null } }]) {
    const env = setup(() => { if (reply instanceof Error) throw reply; return reply; });
    await assert.rejects(env.api.createRollpe(valid));
    assert.equal(env.calls.length, 1);
  }
});

test('authentication and cancellation errors keep their identity for navigation and disposal', async () => {
  const required = new AuthenticationRequiredError();
  const { api } = setup(() => { throw required; });
  await assert.rejects(api.createRollpe(valid), error => error === required);
  await assert.rejects(api.fetchRollpeOptions(), error => error === required);
  await assert.rejects(api.searchRecipients('name'), error => error === required);
  const controller = new AbortController(); controller.abort();
  const cancelled = new Error('cancelled');
  await assert.rejects(setup(() => { throw cancelled; }).api.createRollpe(valid, controller.signal), error => error === cancelled);
});
