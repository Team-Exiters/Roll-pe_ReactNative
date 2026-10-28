import type { ConfigContext, ExpoConfig } from 'expo/config';
import ko from './src/i18n/locales/ko.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    '@react-native-community/datetimepicker',
    ['expo-localization', { supportedLocales: ['ko'], supportsRTL: false }],
    ['expo-media-library', { photosPermission: false, savePhotosPermission: ko['permission.savePhotos'],
      granularPermissions: [], isAccessMediaLocationEnabled: false }],
  ];
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const kakaoKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

  const appLinkPaths = new Map<string, Set<string>>();
  for (const [value, paths] of [
    [process.env.EXPO_PUBLIC_API_URL, ['/api/user/password-reset/', '/rollpe/']],
    [process.env.EXPO_PUBLIC_WEB_URL, ['/rollpe/']],
  ] as const) {
    try {
      const url = new URL(value ?? '');
      if (value !== value?.trim() || url.protocol !== 'https:' || url.username || url.password
        || url.port || url.pathname !== '/' || url.search || url.hash
        || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) continue;
      const existing = appLinkPaths.get(url.hostname) ?? new Set<string>();
      paths.forEach(path => existing.add(path));
      appLinkPaths.set(url.hostname, existing);
    } catch {
      // Missing or invalid configuration disables that domain; never assume a server address.
    }
  }

  if (googleScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]);
  }
  if (kakaoKey) {
    plugins.push(['@react-native-seoul/kakao-login', { kakaoAppKey: kakaoKey }]);
  }
  plugins.push(
    ['expo-build-properties', {
      android: { extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'] },
    }],
    // Runs before the Kakao AppDelegate mod, which expects a URL handler in the template.
    './plugins/with-social-app-delegate',
  );

  return {
    ...config,
    name: config.name ?? '롤페',
    slug: config.slug ?? 'ReactNative_Roll-Pe',
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      ...(appLinkPaths.size ? {
        associatedDomains: [...new Set([...(config.ios?.associatedDomains ?? []),
          ...[...appLinkPaths.keys()].map(host => `applinks:${host}`)])],
      } : {}),
    },
    android: {
      ...config.android,
      ...(appLinkPaths.size ? {
        intentFilters: [...(config.android?.intentFilters ?? []), ...[...appLinkPaths].map(([host, paths]) => ({
          action: 'VIEW',
          autoVerify: true,
          data: [...paths].map(pathPrefix => ({ scheme: 'https', host, pathPrefix })),
          category: ['BROWSABLE', 'DEFAULT'],
        }))],
      } : {}),
    },
    plugins,
  };
};
