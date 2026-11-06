const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const settle = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  const children = Array.isArray(tree) ? tree : tree.props?.children;
  return [
    ...(predicate(tree) ? [tree] : []),
    ...(Array.isArray(children) ? children : [children]).flatMap((child) =>
      nodes(child, predicate),
    ),
  ];
}
const ofType = (tree, type) => nodes(tree, (node) => node.type === type);

function setup({ platform = 'web', overrides = {} } = {}) {
  const states = [],
    refs = [],
    focus = [],
    effects = [];
  let cursor = 0,
    refCursor = 0,
    keyboardDismissals = 0;
  const user = { id: 1, name: 'preview', provider: null };
  const mocks = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [
          states[index],
          (value) => {
            states[index] = typeof value === 'function' ? value(states[index]) : value;
          },
        ];
      },
      useRef(value) {
        const index = refCursor++;
        return (refs[index] ??= { current: value });
      },
      useCallback: (callback) => callback,
      useEffect: (callback) => effects.push(callback),
    },
    'react-native': {
      Platform: { OS: platform },
      StyleSheet: { create: (value) => value },
      Keyboard: { dismiss: () => keyboardDismissals++ },
      View: 'View',
      Text: 'Text',
      ScrollView: 'ScrollView',
      Pressable: 'Pressable',
      ActivityIndicator: 'ActivityIndicator',
    },
    'expo-image': { Image: 'Image' },
    'expo-router': {
      useFocusEffect: (callback) => focus.push(callback),
      useLocalSearchParams: () => ({}),
      useRouter: () => ({}),
    },
    '@/constants/theme': {
      OVERLAY_COLOR: 'rgba(0,0,0,0.6)',
      RollpeFonts: {},
      useRollpeColors: () => ({}),
    },
    '@/i18n': { useTranslation: () => ({ t: (key) => key }) },
    '@/hooks/useSafeAreaSpacing': { useSafeAreaSpacing: () => () => 0 },
    '@/hooks/useAppNavigation': {
      useAppNavigation: () => ({ openWelcome() {}, openSignIn() {}, finishSignIn() {} }),
    },
    '@/features/welcome/WelcomeScreen': { __esModule: true, default: 'WelcomeScreen' },
    '@/features/home/components/RollpeCard': { RollpeCard: 'RollpeCard' },
    '@/features/home/api': {
      fetchHomeStatus: async () => ({ host: 1, heart: 2 }),
      fetchHotRollpes: async () => [],
    },
    '@/features/my-page/api': { myRollpeTitles: {} },
    '@/features/my-page/account-api': { changeAccount: async () => '' },
    '@/features/sign-in/token-state': { getTokenState: async () => ({ user }) },
    '@/features/sign-in/pending-rollpe': {
      clearPendingRollpeDestination: async () => {},
      getPendingRollpeDestination: async () => null,
    },
    '@/lib/authenticated-api': {
      AuthenticationRequiredError: class extends Error {},
      restoreTokenState: async () => null,
    },
    ...overrides,
  };
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative);
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    vm.runInNewContext(
      source,
      {
        exports,
        AbortController,
        setInterval: () => 1,
        clearInterval() {},
        require(name) {
          if (name in mocks) return mocks[name];
          if (name === 'react/jsx-runtime') return require(name);
          if (name.startsWith('@/assets/')) return 'asset';
          if (name.startsWith('@/components/') || name.includes('/components/')) {
            const component = name.split('/').at(-1);
            return { [component]: component };
          }
          throw new Error(`Unexpected module: ${name}`);
        },
      },
      { filename },
    );
    return exports;
  }
  return {
    load,
    focus,
    effects,
    mocks,
    states,
    get keyboardDismissals() {
      return keyboardDismissals;
    },
    render(Component, props = {}) {
      cursor = 0;
      refCursor = 0;
      focus.length = 0;
      effects.length = 0;
      return Component(props);
    },
  };
}

test('a pending dialog removes its card and buttons, uses LoadingView and blocks dismissal', () => {
  const ui = setup();
  const { AppDialog } = ui.load('components/ui/AppDialog.tsx');
  let closed = 0;
  const tree = ui.render(AppDialog, {
    message: 'confirm',
    busy: true,
    onConfirm() {},
    onCancel: () => closed++,
  });
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  assert.equal(nodes(tree, (node) => node.props?.role === 'alertdialog').length, 0);
  assert.equal(ofType(tree, 'PrimaryButton').length, 0);
  assert.equal(ofType(tree, 'ActivityIndicator').length, 0);
  assert.equal(tree.props.backdrop, null, 'LoadingView owns the only dimmed backdrop');
  tree.props.onClose();
  assert.equal(closed, 0);
  ui.effects.forEach((effect) => effect());
  assert.equal(ui.keyboardDismissals, 1);
  const ready = ui.render(AppDialog, {
    message: 'retry',
    busy: false,
    onConfirm() {},
    onCancel: () => closed++,
  });
  assert.equal(ofType(ready, 'LoadingView').length, 0);
  assert.equal(nodes(ready, (node) => node.props?.role === 'alertdialog').length, 1);
  ready.props.onClose();
  assert.equal(closed, 1);
});

test('inline iOS dialogs also replace the confirmation card without opening another native modal', () => {
  const ui = setup({ platform: 'ios' });
  const tree = ui.render(ui.load('components/ui/AppDialog.tsx').AppDialog, {
    busy: true,
    inline: true,
    onConfirm() {},
  });
  assert.equal(ofType(tree, 'AppModal').length, 0);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  assert.equal(nodes(tree, (node) => node.props?.role === 'alertdialog').length, 0);
  assert.equal(tree.props.style.backgroundColor, undefined);
});

test('startup keeps welcome beneath loading and retry, without exposing interactive background controls', async () => {
  const ui = setup({
    overrides: {
      '@/lib/authenticated-api': {
        restoreTokenState: async () => {
          throw new Error('offline');
        },
      },
    },
  });
  const Screen = ui.load('features/sign-in/components/StartupGate.tsx').default;
  const tree = ui.render(Screen);
  assert.equal(ofType(tree, 'WelcomeScreen').length, 1);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  assert.ok(
    nodes(tree, (node) => node.props?.pointerEvents === 'none' && node.props?.['aria-hidden'])
      .length,
  );
  ui.focus[0]();
  await settle();
  const failed = ui.render(Screen);
  assert.equal(ofType(failed, 'WelcomeScreen').length, 1);
  assert.equal(ofType(failed, 'LoadingView').length, 0);
  ofType(failed, 'AppDialog')[0].props.onConfirm();
  const retrying = ui.render(Screen);
  assert.equal(ofType(retrying, 'WelcomeScreen').length, 1);
  assert.equal(ofType(retrying, 'LoadingView').length, 1);
});

test('home renders its layout before slow requests finish, then removes the overlay on success', async () => {
  const status = deferred(),
    papers = deferred();
  const ui = setup({
    overrides: {
      '@/features/home/api': {
        fetchHomeStatus: () => status.promise,
        fetchHotRollpes: () => papers.promise,
      },
    },
  });
  const Screen = ui.load('features/home/HomeScreen.tsx').default;
  let tree = ui.render(Screen);
  assert.equal(ofType(tree, 'AppFooter').length, 1);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  assert.equal(ofType(tree, 'ActivityIndicator').length, 0);
  const invite = ofType(tree, 'PrimaryButton').find((node) => node.props.title === 'home.invited');
  assert.equal(invite.props.disabled, true);
  ui.focus[0]();
  await settle();
  tree = ui.render(Screen);
  assert.equal(ofType(tree, 'AppFooter').length, 1);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  status.resolve({ host: 1, heart: 2 });
  papers.resolve([]);
  await settle();
  tree = ui.render(Screen);
  assert.equal(ofType(tree, 'LoadingView').length, 0);
  assert.equal(ofType(tree, 'AppFooter').length, 1);
});

test('home retains already displayed cards during a same-user retry and never gets stuck loading after a failure', async () => {
  let hold = null;
  const ui = setup({
    overrides: {
      '@/features/home/api': {
        fetchHomeStatus: async () => ({ host: 1, heart: 1 }),
        fetchHotRollpes: () => hold?.promise ?? Promise.resolve([{ id: 1 }]),
      },
    },
  });
  const Screen = ui.load('features/home/HomeScreen.tsx').default;
  ui.render(Screen);
  ui.focus[0]();
  await settle();
  assert.equal(ofType(ui.render(Screen), 'RollpeCard').length, 1);
  hold = deferred();
  ui.focus[0]();
  await settle();
  const retrying = ui.render(Screen);
  assert.equal(ofType(retrying, 'RollpeCard').length, 1);
  assert.equal(ofType(retrying, 'LoadingView').length, 1);
  hold.reject(new Error('offline'));
  await settle();
  assert.equal(ofType(ui.render(Screen), 'LoadingView').length, 0);
});

test('my page keeps its profile layout, menu and footer beneath initial loading', () => {
  const ui = setup();
  const tree = ui.render(ui.load('features/my-page/MyPageScreen.tsx').default);
  assert.equal(ofType(tree, 'AppFooter').length, 1);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  assert.equal(ofType(tree, 'ActivityIndicator').length, 0);
  assert.ok(nodes(tree, (node) => node.props?.children === 'home.myPage').length);
});

test('paper refresh preserves its background but clears private content on access failure or blur', async () => {
  let next;
  class RollpeAccessError extends Error {}
  const ui = setup({
    overrides: {
      '@/features/rollpe-info/api': { RollpeAccessError, fetchRollpeInfo: () => next.promise },
      '@/features/rollpe-info/model': {
        normalizeRollpeCode: () => 'preview',
        rollpeRole: () => 'host',
        isRollpeDelivered: () => false,
        remainingTime: () => '',
      },
      '@/features/rollpe-info/save-image': {},
      '@/features/invitations/api': { InvitationError: class extends Error {} },
    },
  });
  ui.mocks['react-native'].AppState = { addEventListener: () => ({ remove() {} }) };
  const Route = ui.load('features/rollpe-info/RollpeInfoScreen.tsx').default;
  const { type: Screen, props } = ui.render(Route);
  const paper = {
    code: 'preview',
    title: 'preview',
    receive: {},
    host: { id: 1 },
    hearts: { data: [], count: 0 },
  };
  next = deferred();
  ui.render(Screen, props);
  const clearOnBlur = ui.focus[0]();
  let cancel = ui.focus[1]();
  next.resolve(paper);
  await settle();
  assert.equal(ofType(ui.render(Screen, props), 'RollpePaper').length, 1);

  cancel(); // An in-place refresh cleans up its request, not the focused screen.
  next = deferred();
  cancel = ui.focus[1]();
  await settle();
  const refreshing = ui.render(Screen, props);
  assert.equal(ofType(refreshing, 'RollpePaper').length, 1);
  assert.equal(ofType(refreshing, 'LoadingView').length, 1);
  next.reject(new RollpeAccessError('permission lost'));
  await settle();
  assert.equal(ofType(ui.render(Screen, props), 'RollpePaper').length, 0);

  cancel();
  next = deferred();
  cancel = ui.focus[1]();
  next.resolve(paper);
  await settle();
  assert.equal(ofType(ui.render(Screen, props), 'RollpePaper').length, 1);
  clearOnBlur();
  cancel();
  assert.equal(ofType(ui.render(Screen, props), 'RollpePaper').length, 0);
});
