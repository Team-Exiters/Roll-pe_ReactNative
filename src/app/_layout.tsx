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
      </Stack>
    </>
  );
}
