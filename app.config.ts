import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    '@react-native-community/datetimepicker',
  ];
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const kakaoKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

  let appLinkHost: string | undefined;
  try {
    const value = process.env.EXPO_PUBLIC_API_URL;
    const url = new URL(value ?? '');
    if (value === value?.trim() && url.protocol === 'https:' && !url.username && !url.password
      && !url.port && url.pathname === '/' && !url.search && !url.hash) {
      appLinkHost = url.hostname;
    }
  } catch {
    // Missing or invalid API configuration disables app links; never assume a server domain.
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
      ...(appLinkHost ? {
        associatedDomains: [...(config.ios?.associatedDomains ?? []), `applinks:${appLinkHost}`],
      } : {}),
    },
    android: {
      ...config.android,
      ...(appLinkHost ? {
        intentFilters: [...(config.android?.intentFilters ?? []), {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: appLinkHost, pathPrefix: '/api/user/password-reset/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        }],
      } : {}),
    },
    plugins,
  };
};
