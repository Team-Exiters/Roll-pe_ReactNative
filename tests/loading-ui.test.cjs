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
      FlatList: 'FlatList',
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
    '@/features/content-report/ReportDialog': { ReportDialog: 'ReportDialog' },
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

test('heart editor keeps memo and palette geometry fixed while the keyboard resizes its modal window', () => {
  for (const platform of ['android', 'ios']) {
    let keyboardHide;
    const ui = setup({ platform, overrides: {
      'react-native': {
        Platform: { OS: platform }, StyleSheet: { create: value => value },
        Keyboard: { dismiss() {}, addListener(event, callback) { keyboardHide = callback; return { remove() {} }; } },
        View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
      },
      'expo-font': { useFonts: () => [true, null] },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      '@/features/rollpe-content/api': { fetchHeartColors: async () => [], HeartMutationError: class extends Error {} },
      '@/features/rollpe-content/model': { normalizeHeartColor: () => '', cleanHeartContent: value => value },
      '@/features/user-blocking/api': { changeUserBlock: async () => {} },
    } });
    const { HeartModal } = ui.load('features/rollpe-content/components/HeartModal.tsx');
    const props = { paper: { theme: '화이트', host: { id: 1 } }, user: { id: 1 }, index: 0 };
    let tree = ui.render(HeartModal, props);
    assert.equal(tree.props.avoidKeyboard, undefined);
    ui.effects.forEach(effect => effect());
    const layout = (width, height) => ({ nativeEvent: { layout: { width, height } } });
    const measuringView = tree => nodes(tree, node => node.props?.onLayout)[0];
    measuringView(tree).props.onLayout(layout(400, 800));
    tree = ui.render(HeartModal, props);
    const before = ofType(tree, 'TextInput')[0].props.style;
    ofType(tree, 'TextInput')[0].props.onFocus();
    tree = ui.render(HeartModal, props);
    measuringView(tree).props.onLayout(layout(400, 480));
    tree = ui.render(HeartModal, props);
    assert.deepEqual(ofType(tree, 'TextInput')[0].props.style, before);
    assert.equal(nodes(tree, node => Array.isArray(node.props?.style) && node.props.style.some(style => style?.height === 800)).length, 1);
    keyboardHide();
    tree = ui.render(HeartModal, props);
    measuringView(tree).props.onLayout(layout(400, 800));
    tree = ui.render(HeartModal, props);
    assert.deepEqual(ofType(tree, 'TextInput')[0].props.style, before);
    // Android can reopen the keyboard without firing another focus event.
    ofType(tree, 'TextInput')[0].props.onPressIn();
    tree = ui.render(HeartModal, props);
    measuringView(tree).props.onLayout(layout(400, 480));
    tree = ui.render(HeartModal, props);
    assert.deepEqual(ofType(tree, 'TextInput')[0].props.style, before);
  }
});

test('report dialog validates selection, replaces its card with shared loading, and submits only once', async () => {
  const reply = deferred();
  const calls = [];
  const ui = setup({ overrides: {
    '@/features/content-report/api': { reportReasons: ['spam', 'abuse', 'inappropriate', 'other'],
      submitContentReport: (...args) => { calls.push(args); return reply.promise; } },
  } });
  const { ReportDialog } = ui.load('features/content-report/ReportDialog.tsx');
  let closed = 0;
  const props = { target: { type: 'heart', code: 'target-code' }, onClose: () => closed++, onAuthenticationRequired() {} };
  let tree = ui.render(ReportDialog, props);
  tree.props.onConfirm();
  tree = ui.render(ReportDialog, props);
  assert.equal(calls.length, 0);
  assert.equal(nodes(tree, node => node.props?.accessibilityRole === 'alert').length, 1);
  nodes(tree, node => node.props?.accessibilityRole === 'radio')[1].props.onPress();
  tree = ui.render(ReportDialog, props);
  const selectedReason = nodes(tree, node => node.props?.accessibilityRole === 'radio')[1];
  assert.equal(selectedReason.props['aria-checked'], true);
  assert.equal(selectedReason.props.accessibilityState.checked, true);
  tree.props.onConfirm();
  tree.props.onConfirm();
  tree = ui.render(ReportDialog, props);
  assert.equal(tree.type, 'AppDialog');
  assert.equal(tree.props.busy, true, 'the existing dialog shows the shared LoadingView instead of its form');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'abuse');
  reply.resolve('접수 완료'); await settle();
  tree = ui.render(ReportDialog, props);
  assert.equal(tree.props.busy, false);
  assert.equal(tree.props.message, '접수 완료');
  assert.equal(tree.props.children, false);
  tree.props.onConfirm();
  assert.equal(closed, 1);
});

test('closing a report aborts its pending request and a late receipt cannot update the closed dialog', async () => {
  const reply = deferred(); let signal;
  const ui = setup({ overrides: {
    '@/features/content-report/api': { reportReasons: ['spam'], submitContentReport: (...args) => { signal = args[3]; return reply.promise; } },
  } });
  const { ReportDialog } = ui.load('features/content-report/ReportDialog.tsx');
  const props = { target: { type: 'paper', code: 'target' }, onClose() {}, onAuthenticationRequired() {} };
  let tree = ui.render(ReportDialog, props);
  const cleanup = ui.effects[0]();
  nodes(tree, node => node.props?.accessibilityRole === 'radio')[0].props.onPress();
  tree = ui.render(ReportDialog, props);
  tree.props.onConfirm();
  cleanup();
  assert.equal(signal.aborted, true);
  reply.resolve('late receipt'); await settle();
  tree = ui.render(ReportDialog, props);
  assert.notEqual(tree.props.message, 'late receipt');
});

test('blocked-user pagination preserves loaded users after an error and ignores duplicate load requests', async () => {
  const first = { id: 1, name: 'first', identifyCode: 'FIRST1' };
  const second = { id: 2, name: 'second', identifyCode: 'SECOND' };
  const calls = [];
  let next = deferred();
  const ui = setup({ overrides: {
    '@/features/user-blocking/api': {
      fetchBlockedUsers: (page) => {
        calls.push(page);
        return page === 1 ? Promise.resolve({ items: [first], count: 2, nextPage: 2 }) : next.promise;
      },
    },
  } });
  const Screen = ui.load('features/user-blocking/BlockedUsersScreen.tsx').default;
  const list = tree => ofType(tree, 'FlatList')[0].props;
  assert.equal(ofType(ui.render(Screen), 'LoadingView').length, 1);
  ui.focus[0]();
  await settle();
  let tree = ui.render(Screen);
  list(tree).ListFooterComponent.props.onPress();
  list(tree).ListFooterComponent.props.onPress();
  next.reject(new Error('offline'));
  await settle();
  tree = ui.render(Screen);
  ofType(tree, 'AppDialog')[0].props.onConfirm();
  tree = ui.render(Screen);
  assert.equal(list(tree).data[0], first);
  assert.deepEqual(calls, [1, 2]);
  next = deferred();
  list(tree).ListFooterComponent.props.onPress();
  next.resolve({ items: [first, second], count: 2, nextPage: null });
  await settle();
  tree = ui.render(Screen);
  assert.deepEqual(Array.from(list(tree).data, item => item.id), [1, 2]);
  assert.equal(list(tree).ListFooterComponent, undefined);
});

test('blocked-user requests are cancelled on blur and late results cannot overwrite a new load', async () => {
  const requests = [];
  const ui = setup({ overrides: {
    '@/features/user-blocking/api': {
      fetchBlockedUsers: (page, signal) => {
        const request = { signal, ...deferred() };
        requests.push(request);
        return request.promise;
      },
    },
  } });
  const Screen = ui.load('features/user-blocking/BlockedUsersScreen.tsx').default;
  ui.render(Screen);
  const blur = ui.focus[0]();
  blur();
  assert.equal(requests[0].signal.aborted, true);
  ui.render(Screen);
  ui.focus[0]();
  requests[0].resolve({ items: [{ id: 1 }], count: 1, nextPage: null });
  await settle();
  assert.equal(ofType(ui.render(Screen), 'LoadingView').length, 1);
  requests[1].resolve({ items: [{ id: 2 }], count: 1, nextPage: null });
  await settle();
  const tree = ui.render(Screen);
  assert.equal(ofType(tree, 'LoadingView').length, 0);
  assert.equal(ofType(tree, 'FlatList')[0].props.data[0].id, 2);
});

test('unblocking closes confirmation before loading and refreshes the paginated list from its first page', async () => {
  const removal = deferred();
  const user = { id: 3, name: 'blocked', identifyCode: '' };
  const calls = [];
  let removed = false;
  const ui = setup({ overrides: {
    '@/features/user-blocking/api': {
      fetchBlockedUsers: async (page) => {
        calls.push(['load', page]);
        return { items: removed ? [] : [user], count: removed ? 0 : 1, nextPage: null };
      },
      changeUserBlock: (id, blocking) => {
        calls.push(['block', id, blocking]);
        return removal.promise;
      },
    },
  } });
  const Screen = ui.load('features/user-blocking/BlockedUsersScreen.tsx').default;
  ui.render(Screen);
  const cleanup = ui.focus[0]();
  await settle();
  let tree = ui.render(Screen);
  const row = ofType(tree, 'FlatList')[0].props.renderItem({ item: user });
  ofType(row, 'OutlineButton')[0].props.onPress();
  tree = ui.render(Screen);
  ofType(tree, 'AppDialog')[0].props.onConfirm();
  ofType(tree, 'AppDialog')[0].props.onConfirm();
  tree = ui.render(Screen);
  assert.equal(ofType(tree, 'AppDialog').length, 0);
  assert.equal(ofType(tree, 'LoadingView').length, 1);
  removed = true;
  removal.resolve();
  await settle();
  cleanup();
  ui.render(Screen);
  ui.focus[0]();
  await settle();
  tree = ui.render(Screen);
  assert.equal(ofType(tree, 'FlatList')[0].props.data.length, 0);
  assert.equal(ofType(tree, 'LoadingView').length, 0);
  assert.deepEqual(calls, [['load', 1], ['block', 3, false], ['load', 1]]);
});
