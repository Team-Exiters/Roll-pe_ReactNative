import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
  ];
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const kakaoKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

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
    ios: { ...config.ios, usesAppleSignIn: true },
    plugins,
  };
};
