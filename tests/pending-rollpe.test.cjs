const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const first = '/rollpe/11111111-1111-4111-8111-111111111111';
const second = '/rollpe/22222222-2222-4222-8222-222222222222';
const key = 'rollpe.pending-rollpe';
const instant = Date.parse('2026-10-28T09:00:00+09:00');

function setup({ platform = 'web', storage = new Map(), ssr = false } = {}) {
  const state = { now: instant }, writes = [], cache = new Map();
  class Clock extends Date { static now() { return state.now; } }
  const get = () => {
    if (state.readError) throw new Error('storage unavailable');
    return state.readPromise ?? storage.get(key) ?? null;
  };
  const put = (name, value) => {
    if (state.writeError) throw new Error('storage unavailable');
    writes.push({ key: name, value });
    if (value === null) storage.delete(name); else storage.set(name, value);
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const filename = path.resolve(__dirname, '../src', `${file}.ts`);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, {
      exports, Date: Clock, Error,
      ...(ssr ? {} : { window: { sessionStorage: { getItem: get, setItem: put, removeItem: name => put(name, null) } } }),
      require: name => {
        if (name === 'react-native') return { Platform: { OS: platform } };
        if (name === '@/utils/rollpe-link') return load('utils/rollpe-link');
        if (name === 'expo-secure-store') return {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only', getItemAsync: async () => get(),
          setItemAsync: async (name, value, options) => {
            state.started?.();
            await state.writeGate;
            state.options = options;
            put(name, value);
          },
          deleteItemAsync: async name => put(name, null),
        };
        throw new Error(`Unexpected module: ${name}`);
      },
    }, { filename });
    return exports;
  }
  return { ...load('features/sign-in/pending-rollpe'), state, storage, writes };
}

test('only canonical local paper destinations can be remembered or used as sign-in returns', async () => {
  const state = setup();
  assert.equal(await state.rememberRollpeDestination(first.toUpperCase().replace('/ROLLPE/', '/rollpe/')), first);
  for (const value of [[], [first], 'https://evil.example', '//evil.example', '/home', `${first}?password=secret`, `${first}#token=secret`, '/rollpe/bad']) {
    assert.equal(await state.rememberRollpeDestination(value), null);
    assert.equal(await state.resolveRollpeDestination(value), first);
  }
  assert.equal(await state.resolveRollpeDestination(second), second);
  assert.deepEqual(Object.keys(JSON.parse(state.storage.get(key))).sort(), ['destination', 'expiresAt']);
});

test('registration, email verification and restarting the app keep the destination without retaining credentials', async () => {
  for (const platform of ['web', 'ios', 'android']) {
    const storage = new Map(), state = setup({ platform, storage });
    await state.rememberRollpeDestination(first);
    const restarted = setup({ platform, storage });
    assert.equal(await restarted.resolveRollpeDestination(), first);
    assert.equal(JSON.parse(storage.get(key)).destination, first);
    if (platform !== 'web') assert.equal(state.state.options.keychainAccessible, 'device-only');
    await restarted.clearPendingRollpeDestination(first);
    assert.equal(await setup({ platform, storage }).getPendingRollpeDestination(), null);
  }
});

test('cancelling or finishing an old paper cannot remove a newer link', async () => {
  const state = setup();
  await state.rememberRollpeDestination(first);
  await state.rememberRollpeDestination(second);
  await state.clearPendingRollpeDestination(first);
  assert.equal(await state.getPendingRollpeDestination(), second);
  await state.clearPendingRollpeDestination(second);
  assert.equal(await state.getPendingRollpeDestination(), null);
  assert.equal(state.storage.has(key), false);
});

test('expired, malformed and tampered stored destinations are discarded', async () => {
  for (const value of ['bad json', 'null', JSON.stringify({ destination: first, expiresAt: instant }),
    JSON.stringify({ destination: first, expiresAt: instant + 25 * 60 * 60 * 1000 }),
    JSON.stringify({ destination: '//evil.example', expiresAt: instant + 1000 }),
    JSON.stringify({ destination: first, expiresAt: 'tomorrow' })]) {
    const state = setup({ storage: new Map([[key, value]]) });
    assert.equal(await state.getPendingRollpeDestination(), null);
    assert.equal(state.storage.has(key), false);
  }
  const state = setup();
  await state.rememberRollpeDestination(first);
  state.state.now += 24 * 60 * 60 * 1000;
  assert.equal(await state.getPendingRollpeDestination(), null);
});

test('a delayed native storage read cannot overwrite a new link or revive a cancelled link', async () => {
  let finish;
  const state = setup({ platform: 'ios' });
  state.state.readPromise = new Promise(resolve => { finish = resolve; });
  const reading = state.getPendingRollpeDestination();
  await state.rememberRollpeDestination(second);
  await state.clearPendingRollpeDestination(second);
  finish(JSON.stringify({ destination: first, expiresAt: instant + 1000 }));
  assert.equal(await reading, null);
  assert.equal(state.storage.has(key), false);
});

test('serial native writes keep the latest link even if an earlier write finishes after cancellation', async () => {
  let finish, started;
  const state = setup({ platform: 'ios' });
  const writing = new Promise(resolve => { started = resolve; });
  state.state.started = started;
  state.state.writeGate = new Promise(resolve => { finish = resolve; });
  const firstWrite = state.rememberRollpeDestination(first);
  await writing;
  const clear = state.clearPendingRollpeDestination(first);
  const secondWrite = state.rememberRollpeDestination(second);
  finish();
  await Promise.all([firstWrite, clear, secondWrite]);
  assert.equal(await state.getPendingRollpeDestination(), second);
  assert.equal(JSON.parse(state.storage.get(key)).destination, second);
});

test('storage failure keeps this run navigable and preserves an explicit destination', async () => {
  for (const platform of ['web', 'ios']) {
    const state = setup({ platform });
    state.state.readError = true; state.state.writeError = true;
    assert.equal(await state.getPendingRollpeDestination(), null);
    await state.rememberRollpeDestination(first);
    assert.equal(await state.resolveRollpeDestination(), first);
    assert.equal(await state.resolveRollpeDestination(second), second);
    await state.clearPendingRollpeDestination(first);
    assert.equal(await state.getPendingRollpeDestination(), null);
  }
});

test('server rendering never reads browser storage or shares a pending destination across requests', async () => {
  const state = setup({ ssr: true });
  assert.equal(await state.rememberRollpeDestination(first), null);
  assert.equal(await state.getPendingRollpeDestination(), null);
  await state.clearPendingRollpeDestination(first);
  assert.equal(state.writes.length, 0);
});
