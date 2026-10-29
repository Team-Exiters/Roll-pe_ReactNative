const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { attachAxiosTransport } = require('./axios-transport.cjs');

// Exercise actual services with only SDK, network, and storage boundaries replaced.
function loadServices({ platform = 'web', enabled = true, storage = new Map(), env = {} } = {}) {
  const calls = { open: [], navigate: [], history: [], fetch: [], saved: [], deleted: [], google: [], playServices: [], kakao: [], apple: [] };
  const state = { callback: null, payload: null, ok: true };
  const mocks = {
    'expo-crypto': {
      getRandomBytes: randomBytes,
      CryptoDigestAlgorithm: { SHA256: 'sha256' },
      CryptoEncoding: { BASE64: 'base64' },
      digestStringAsync: async (_, value) => createHash('sha256').update(value).digest('base64'),
    },
    'expo-web-browser': {
      openAuthSessionAsync: async (...args) => {
        calls.open.push(args);
        if (state.browserGate) await state.browserGate;
        if (state.browserError) throw state.browserError;
        return state.callback;
      },
    },
    'react-native': { Platform: { OS: platform } },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
      setItemAsync: async (key, value, options) => {
        storage.set(key, value); calls.saved.push({ value: JSON.parse(value), options });
      },
      getItemAsync: async (key) => state.storageReadPromise ?? storage.get(key) ?? null,
      deleteItemAsync: async (key) => {
        calls.deleted.push(key);
        if (state.storageDeleteError) throw state.storageDeleteError;
        storage.delete(key);
      },
    },
    '@react-native-google-signin/google-signin': {
      GoogleSignin: {
        configure: (options) => calls.google.push(options),
        hasPlayServices: async (options) => {
          calls.playServices.push(options);
          if (state.playServicesError) throw state.playServicesError;
          return true;
        },
        signIn: async () => {
          if (state.googleError) throw state.googleError;
          return state.googleResult ?? { type: 'success', data: { idToken: 'google-id-token' } };
        },
      },
      isSuccessResponse: (response) => response.type === 'success',
    },
    '@react-native-seoul/kakao-login': {
      login: async () => {
        calls.kakao.push('login');
        if (state.kakaoError) throw state.kakaoError;
        return { accessToken: 'kakao-access-token' };
      },
    },
    'expo-apple-authentication': {
      AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
      isAvailableAsync: async () => {
        if (state.appleAvailabilityError) throw state.appleAvailabilityError;
        return state.appleAvailable ?? true;
      },
      signInAsync: async (options) => {
        calls.apple.push(options);
        if (state.appleError) throw state.appleError;
        return {
          state: options.state, identityToken: 'apple-id-token', authorizationCode: 'apple-code',
          fullName: null, ...state.appleResult,
        };
      },
      formatFullName: () => '테스트',
    },
  };
  const modules = new Map();
  const root = path.resolve(__dirname, '../../src/features/sign-in');
  const globals = {
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Error,
    window: {
      document: { title: '' },
      location: {
        origin: 'http://localhost:8081',
        get href() { return state.callback?.url ?? 'http://localhost:8081/sign-in'; },
        get pathname() { return new URL(this.href).pathname; },
        assign: (url) => {
          if (state.navigationError) throw state.navigationError;
          calls.navigate.push(url);
        },
      },
      history: { replaceState: (...args) => calls.history.push(args) },
      sessionStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          if (state.storageWriteError) throw state.storageWriteError;
          storage.set(key, value); calls.saved.push({ key, value: JSON.parse(value) });
        },
        removeItem: (key) => {
          calls.deleted.push(key);
          if (state.storageDeleteError) throw state.storageDeleteError;
          storage.delete(key);
        },
      },
    },
    process: { env: {
      EXPO_PUBLIC_API_URL: 'https://api.example', EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: String(enabled),
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
      EXPO_PUBLIC_KAKAO_REST_API_KEY: 'rest-key',
      EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'native-key', ...env,
    } },
    fetch: async (...args) => {
      calls.fetch.push(args);
      if (state.responseGate) await state.responseGate;
      if (state.networkError) throw state.networkError;
      const reply = state.responses?.shift();
      if (reply?.error) throw reply.error;
      if (reply) return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, json: async () => {
        if (reply.jsonError) throw reply.jsonError;
        return reply.payload;
      } };
      return { ok: state.ok, status: state.ok ? 201 : 401, json: async () => {
        if (state.jsonError) throw state.jsonError;
        return state.payload;
      } };
    },
  };
  function load(name) {
    const filename = name === 'shared-api'
      ? path.resolve(root, '../../lib/api.ts') : path.join(root, `${name}.ts`);
    assert.ok(name === 'shared-api' || filename.startsWith(root));
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(output, {
      ...globals, exports,
      require: (name) => {
        if (name === '@/i18n') return require('./i18n.cjs');
        if (name === 'axios') return require('axios');
        if (name === '@/lib/api') return load('shared-api');
        if (name.startsWith('@/features/sign-in/')) return load(name.slice('@/features/sign-in/'.length));
        assert.ok(name in mocks, `Unexpected import: ${name}`);
        return mocks[name];
      },
    }, { filename });
    if (name === 'shared-api') attachAxiosTransport(exports.apiClient, globals.fetch);
    return exports;
  }
  return { load, calls, state, storage };
}

module.exports = { loadServices };
