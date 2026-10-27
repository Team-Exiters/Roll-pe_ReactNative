import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { useTranslation } from '@/i18n';
import { DeviceLanguage } from '@/i18n/DeviceLanguage';
import { RollpeFonts, useRollpeColors } from "@/constants/theme";
import { WebViewport } from '@/components/WebViewport';

export { ErrorBoundary } from "expo-router";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [fontsLoaded, fontError] = useFonts({
    [RollpeFonts.display]: require("@/assets/fonts/Hakgyoansim-Dunggeunmiso-R.otf"),
    [RollpeFonts.regular]: require("@/assets/fonts/Pretendard-Regular.otf"),
    [RollpeFonts.semibold]: require("@/assets/fonts/Pretendard-SemiBold.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <WebViewport style={{ flex: 1 }}>
      <DeviceLanguage />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.rollpe_primary },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: t('common.brand'), gestureEnabled: false }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ title: t('common.signIn'), gestureEnabled: true }}
        />
        <Stack.Screen name="home" options={{ title: t('common.home'), gestureEnabled: false }} />
        <Stack.Screen name="search" options={{ title: t('home.search'), gestureEnabled: false }} />
        <Stack.Screen name="my-page" options={{ title: t('home.myPage'), gestureEnabled: false }} />
        <Stack.Screen name="change-password" options={{ title: t('account.changePassword'), gestureEnabled: true }} />
        <Stack.Screen name="my-page/rollpes/[kind]" options={{ title: t('home.myPage'), gestureEnabled: true }} />
        <Stack.Screen name="invitations" options={{ title: t('invitations.title'), gestureEnabled: true }} />
        <Stack.Screen name="create-rollpe" options={{ title: t('common.createRollpe'), gestureEnabled: true }} />
        <Stack.Screen name="rollpe/[code]" options={{ title: t('info.title'), gestureEnabled: true }} />
        <Stack.Screen name="rollpe/[code]/content" options={{ title: t('heart.title'), gestureEnabled: false }} />
        <Stack.Screen name="rollpe-error" options={{ title: t('common.error'), gestureEnabled: false }} />
        <Stack.Screen name="forgot-password" options={{ title: t('common.forgotPassword'), gestureEnabled: true }} />
        <Stack.Screen name="reset-password" options={{ title: t('common.resetPassword'), gestureEnabled: true }} />
        <Stack.Screen name="sign-up" options={{ title: t('common.signUp'), gestureEnabled: true }} />
        <Stack.Screen name="policy" options={{ title: t('common.policy'), gestureEnabled: true }} />
      </Stack>
    </WebViewport>
  );
}
