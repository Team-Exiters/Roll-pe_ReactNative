const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const CommonActions = require('expo-router/build/react-navigation/routers/CommonActions');
const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');

const invitation = '/rollpe/11111111-1111-4111-8111-111111111111';
const routeNames = ['index', 'sign-in', 'home', 'search', 'my-page', 'change-password',
  'my-page/rollpes/[kind]', 'rollpe/[code]', 'rollpe/[code]/content', 'forgot-password', 'reset-password', 'sign-up', 'auth/apple'];

function load(relative, mocks) {
  const filename = path.resolve(__dirname, '../src', relative);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(source, { exports, AbortController, require(name) {
    if (name in mocks) return mocks[name];
    if (name === '@/utils/rollpe-link') return load('utils/rollpe-link.ts', {});
    if (name === 'react/jsx-runtime') return require(name);
    throw new Error(`Unexpected import: ${name}`);
  } }, { filename });
  return exports;
}

function setup(routes) {
  const reducer = StackRouter({ initialRouteName: 'index' });
  const config = { routeNames, routeParamList: {}, routeGetIdList: {} };
  let state = { stale: false, type: 'stack', key: 'root', routeKeySeq: routes.length,
    routeNames, index: routes.length - 1,
    routes: routes.map((route, index) => ({ key: `initial-${index}`, ...(typeof route === 'string' ? { name: route } : route) })),
  };
  const actions = [];
  const navigation = { getState: () => state, dispatch(action) {
    const result = reducer.getStateForAction(state, action, config);
    actions.push(action);
    if (!result.state) return false;
    state = result.state;
    return true;
  } };
  const { useAppNavigation } = load('hooks/useAppNavigation.ts', {
    react: { useCallback: callback => callback },
    'expo-router': { useNavigation: root => { assert.equal(root, '/'); return navigation; } },
    'expo-router/react-navigation': { CommonActions },
  });
  return { ...useAppNavigation(), actions, dispatch: navigation.dispatch,
    get state() { return state; }, names: () => Array.from(state.routes, route => route.name) };
}

test('logout replaces every private route with welcome and login; one back returns to welcome', () => {
  for (const routes of [['home'], ['home', 'my-page'], ['home', 'my-page', 'change-password']]) {
    const app = setup(routes);
    app.openSignIn();
    assert.deepEqual(app.names(), ['index', 'sign-in']);
    assert.equal(app.actions.length, 1, 'authentication transition is one action, not dismiss + replace');
    assert.equal(app.state.routes[0].params.welcome, 'true');
    assert.equal(app.dispatch(CommonActions.goBack()), true);
    assert.deepEqual(app.names(), ['index']);
    assert.equal(app.dispatch(CommonActions.goBack()), false);
  }
});

test('direct login links gain a welcome anchor without remounting the form or looping on focus', () => {
  const app = setup([{ name: 'sign-in', params: { returnTo: invitation } }]);
  const formKey = app.state.routes[0].key;
  app.openSignIn(invitation);
  assert.equal(app.state.routes[1].key, formKey);
  app.openSignIn(invitation);
  assert.equal(app.actions.length, 1);
  assert.equal(app.state.routes[1].params.returnTo, invitation);
});

test('registration and recovery return to the existing login form, preserving the invite and avoiding duplicates', () => {
  for (const screen of ['sign-up', 'forgot-password', 'reset-password']) {
    const app = setup(['index', { name: 'sign-in', params: { returnTo: invitation } }, screen]);
    const formKey = app.state.routes[1].key;
    app.openSignIn();
    assert.deepEqual(app.names(), ['index', 'sign-in']);
    assert.equal(app.state.routes[1].key, formKey);
    assert.equal(app.state.routes[1].params.returnTo, invitation);
    app.dispatch(CommonActions.goBack());
    assert.deepEqual(app.names(), ['index']);
  }
});

test('login starts a fresh home stack; repeated logins cannot retain another account screen', () => {
  const app = setup(['index', 'sign-in']);
  app.finishSignIn();
  assert.deepEqual(app.names(), ['home']);
  const homeKey = app.state.routes[0].key;
  assert.equal(app.dispatch(CommonActions.goBack()), false);
  app.dispatch(StackActions.push('my-page'));
  app.openSignIn();
  app.finishSignIn();
  assert.deepEqual(app.names(), ['home']);
  assert.notEqual(app.state.routes[0].key, homeKey);
});

test('OAuth and invited login remove callback/form routes and return to the paper with home underneath', () => {
  for (const routes of [['auth/apple'], ['index', 'sign-in'], ['home', 'rollpe/[code]', 'auth/apple']]) {
    const app = setup(routes);
    app.finishSignIn(invitation);
    assert.deepEqual(app.names(), ['home', 'rollpe/[code]']);
    assert.equal(app.state.routes[1].params.code, invitation.slice('/rollpe/'.length));
    app.dispatch(CommonActions.goBack());
    assert.deepEqual(app.names(), ['home']);
  }
});

test('only validated local invitation paths can become a post-login destination', () => {
  for (const destination of ['https://example.com', '//example.com', '/rollpe/invalid', `${invitation}?token=secret`, [invitation]]) {
    const app = setup(['sign-in']);
    app.finishSignIn(destination);
    assert.deepEqual(app.names(), ['home']);
  }
});

test('switching sidebar destinations keeps one home and removes obsolete details and sibling screens', () => {
  const app = setup(['home', 'my-page', 'my-page/rollpes/[kind]', 'rollpe/[code]']);
  const homeKey = app.state.routes[0].key;
  for (const destination of ['search', 'my-page', 'search']) {
    app.openMainScreen(destination);
    assert.deepEqual(app.names(), ['home', destination]);
    assert.equal(app.state.routes[0].key, homeKey);
  }
  app.openMainScreen();
  assert.deepEqual(app.names(), ['home']);
  assert.equal(app.dispatch(CommonActions.goBack()), false);
});

test('signed-out history entries and invitation cancellation can return to welcome without a login loop', () => {
  const app = setup(['home', 'rollpe/[code]']);
  app.openWelcome();
  assert.deepEqual(app.names(), ['index']);
  assert.equal(app.state.routes[0].params.welcome, 'true');
  assert.equal(app.dispatch(CommonActions.goBack()), false);
});

function startup({ welcome, token = null, pending = null } = {}) {
  let effect, cursor = 0;
  const states = [], transitions = [], statusChanges = [];
  const { default: StartupGate } = load('features/sign-in/components/StartupGate.tsx', {
    react: { useCallback: callback => callback, useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
        statusChanges.push(states[index]);
      }];
    } },
    'expo-router': { useFocusEffect: callback => { effect = callback; },
      useLocalSearchParams: () => ({ welcome }), useRouter: () => ({ replace: route => transitions.push(['replace', route]) }) },
    'react-native': { StyleSheet: { create: value => value }, Text: 'text', View: 'view' },
    '@/i18n': { useTranslation: () => ({ t: key => key }) },
    '@/constants/theme': { RollpeFonts: {}, useRollpeColors: () => ({}) },
    '@/components/ui/LoadingView': { LoadingView: 'loading' },
    '@/components/ui/PrimaryButton': { PrimaryButton: 'button' },
    '@/components/ui/AppDialog': { AppDialog: 'dialog' },
    '@/features/welcome/WelcomeScreen': { default: 'welcome' },
    '@/hooks/useAppNavigation': { useAppNavigation: () => ({ finishSignIn: route => transitions.push(['login', route]) }) },
    '@/lib/authenticated-api': { restoreTokenState: async () => token },
    '@/features/sign-in/pending-rollpe': { getPendingRollpeDestination: async () => pending,
      clearPendingRollpeDestination: async () => { pending = null; } },
  });
  function render() { cursor = 0; StartupGate(); }
  render();
  return { states, transitions, statusChanges, get pending() { return pending; }, render,
    focus: () => effect() };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('back to welcome is immediately visible and cancels pending invites instead of reopening the paper', async () => {
  const screen = startup({ welcome: 'true', pending: invitation });
  assert.equal(screen.states[1], 'welcome');
  screen.focus();
  await settle();
  assert.deepEqual(screen.transitions, []);
  assert.equal(screen.pending, null);
  assert.ok(!screen.statusChanges.includes('checking'));
});

test('welcome does not flash a loading screen on return, while cold start still restores an invited login', async () => {
  const screen = startup();
  assert.equal(screen.states[1], 'checking');
  const blur = screen.focus();
  await settle();
  assert.equal(screen.states[1], 'welcome');
  blur();
  screen.render();
  screen.statusChanges.length = 0;
  screen.focus();
  await settle();
  assert.ok(!screen.statusChanges.includes('checking'));
  const invited = startup({ token: {}, pending: invitation });
  invited.focus();
  await settle();
  assert.deepEqual(invited.transitions, [['login', invitation]]);
});

function screenMocks(app, { token = null, params = {} } = {}) {
  const effects = [], calls = [];
  return { effects, calls, mocks: {
    react: { useCallback: callback => callback, useRef: value => ({ current: value }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
    'expo-router': { useFocusEffect: callback => effects.push(callback), useLocalSearchParams: () => params,
      useRouter: () => ({}) },
    'expo-image': { Image: 'image' },
    'react-native': { StyleSheet: { create: styles => styles }, Platform: { OS: 'web' },
      View: 'view', Text: 'text', ActivityIndicator: 'loading', ScrollView: 'scroll', Pressable: 'press',
      KeyboardAvoidingView: 'keyboard' },
    '@/i18n': { useTranslation: () => ({ t: key => key }) },
    '@/constants/theme': { RollpeFonts: {}, useRollpeColors: () => ({}) },
    '@/hooks/useSafeAreaSpacing': { useSafeAreaSpacing: () => () => 0 },
    '@/hooks/useAppNavigation': { useAppNavigation: () => app },
    '@/features/sign-in/token-state': { getTokenState: async () => token },
    '@/lib/authenticated-api': { AuthenticationRequiredError: class extends Error {} },
    '@/features/home/api': { fetchHomeStatus: () => { calls.push('status'); }, fetchHotRollpes: () => { calls.push('papers'); } },
    '@/components/AppFooter': { AppFooter: 'footer' },
    '@/components/AppSideMenu': { AppSideMenu: 'menu' },
    '@/components/ui/PrimaryButton': { PrimaryButton: 'button' },
    '@/components/ui/BackButton': { BackButton: 'back' },
    '@/components/ui/AppDialog': { AppDialog: 'dialog' },
    '@/components/ui/LoadingView': { LoadingView: 'loading' },
    '@/features/home/components/RollpeCard': { RollpeCard: 'paper' },
    '@/features/sign-in/components/SignInForm': { SignInForm: 'form' },
    '@/features/sign-in/components/SocialSignInButton': { SocialSignInButton: 'social' },
    '@/features/sign-in/useSignIn': { useSignIn: () => ({ isLoading: false, canUseProvider: () => false }) },
    '@/features/sign-in/pending-rollpe': { resolveRollpeDestination: async () => params.returnTo ?? null,
      rememberRollpeDestination: async () => {}, clearPendingRollpeDestination: async () => {} },
    '@/assets/images/welcome/background.jpg': 'background',
    '@/assets/images/welcome/logo.png': 'logo',
    '@/assets/images/home/menu.svg': 'menu',
  } };
}

test('restoring a signed-out home from browser history returns to welcome without fetching private data or looping to login', async () => {
  const app = setup(['home']);
  const screen = screenMocks(app);
  load('features/home/HomeScreen.tsx', screen.mocks).default();
  screen.effects[0]();
  await settle();
  assert.deepEqual(app.names(), ['index']);
  assert.deepEqual(screen.calls, []);
});

test('revisiting login while authenticated removes the login route and retains the requested invitation', async () => {
  const app = setup(['sign-in']);
  const screen = screenMocks(app, { token: {}, params: { returnTo: invitation } });
  load('app/sign-in.tsx', screen.mocks).default();
  screen.effects[0]();
  await settle();
  assert.deepEqual(app.names(), ['home', 'rollpe/[code]']);
});

test('leaving login before its focus check resolves cannot redirect the next screen', async () => {
  const app = setup(['sign-in']);
  const screen = screenMocks(app, { token: {} });
  load('app/sign-in.tsx', screen.mocks).default();
  const blur = screen.effects[0]();
  blur();
  await settle();
  assert.equal(app.actions.length, 0);
});

function contentScreen(app, { role = null } = {}) {
  const code = invitation.slice('/rollpe/'.length);
  const screen = screenMocks(app, { params: { code } });
  screen.mocks['expo-router'].useRouter = () => ({
    dismissTo: destination => {
      assert.equal(destination, invitation);
      app.dispatch(StackActions.popTo('rollpe/[code]', { code }));
    },
  });
  if (role) {
    let stateIndex = 0;
    const originalState = screen.mocks.react.useState;
    screen.mocks.react.useState = initial => stateIndex++ === 0
      ? [{ paper: { hearts: { data: [] } }, user: { id: 1 } }, () => {}]
      : originalState(initial);
  }
  Object.assign(screen.mocks, {
    '@/features/rollpe-content/components/HeartModal': { HeartModal: 'heart' },
    '@/features/rollpe-content/components/PaperCanvas': { PaperCanvas: 'paper' },
    '@/features/rollpe-info/api': {},
    '@/features/rollpe-info/model': { normalizeRollpeCode: value => value, rollpeRole: () => role },
    '@/assets/images/home/close.svg': 'close',
  });
  const outer = load('features/rollpe-content/RollpeContentScreen.tsx', screen.mocks).default();
  return { ...screen, tree: outer.type(outer.props) };
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
}

test('closing a paper canvas reuses its information screen or replaces a direct canvas link, never an unrelated previous page', () => {
  for (const routes of [
    ['home', 'rollpe/[code]', 'rollpe/[code]/content'],
    ['my-page', 'rollpe/[code]/content'],
  ]) {
    const app = setup(routes);
    const screen = contentScreen(app);
    const close = findElement(screen.tree, node => node.props?.accessibilityLabel === 'heart.closePaper');
    assert.ok(close);
    close.props.onPress();
    assert.deepEqual(app.names(), [routes[0], 'rollpe/[code]']);
  }
});

test('delivery to the current recipient returns from canvas to the existing information screen without duplicating it', () => {
  const app = setup(['home', 'rollpe/[code]', 'rollpe/[code]/content']);
  const screen = contentScreen(app, { role: 'receiver' });
  assert.equal(screen.tree, null);
  screen.effects.at(-1)();
  assert.deepEqual(app.names(), ['home', 'rollpe/[code]']);
  app.dispatch(CommonActions.goBack());
  assert.deepEqual(app.names(), ['home']);
});
