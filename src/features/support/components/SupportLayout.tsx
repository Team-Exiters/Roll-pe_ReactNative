import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';

export function SupportLayout({ title, children }: { title: string; children: ReactNode }) {
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const { openMainScreen } = useAppNavigation();
  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.rollpe_primary,
          paddingTop: safeArea('top'),
          paddingBottom: safeArea('bottom'),
        },
      ]}
    >
      <View style={styles.header}>
        <BackButton
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : openMainScreen())}
        />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 100, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 37 },
  title: { fontFamily: RollpeFonts.display, fontSize: 28 },
});
