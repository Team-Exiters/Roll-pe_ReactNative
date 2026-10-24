import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { RollpeFonts, useRollpeColors } from "@/constants/theme";

export { ErrorBoundary } from "expo-router";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.rollpe_primary },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "롤페", gestureEnabled: false }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ title: "로그인", gestureEnabled: true }}
        />
        <Stack.Screen name="home" options={{ title: "홈", gestureEnabled: false }} />
        <Stack.Screen name="create-rollpe" options={{ title: "롤페 만들기", gestureEnabled: true }} />
        <Stack.Screen name="forgot-password" options={{ title: "비밀번호 찾기", gestureEnabled: true }} />
        <Stack.Screen name="reset-password" options={{ title: "비밀번호 변경", gestureEnabled: true }} />
        <Stack.Screen name="sign-up" options={{ title: "회원가입", gestureEnabled: true }} />
        <Stack.Screen name="policy" options={{ title: "약관", gestureEnabled: true }} />
      </Stack>
    </>
  );
}
