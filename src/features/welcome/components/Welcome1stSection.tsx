import { Image } from 'expo-image';
import { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/i18n';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type Welcome1stSectionProps = {
  onStart: () => void;
};

export function Welcome1stSection({ onStart }: Welcome1stSectionProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const { height } = useWindowDimensions();
  const arrowOffset = useSharedValue(-8);
  // Viewport units keep the initial server and browser layouts consistent on web.
  const sectionHeight = Platform.OS === 'web' ? ('100svh' as DimensionValue) : height;

  useEffect(() => {
    arrowOffset.set(
      withRepeat(withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true),
    );

    return () => cancelAnimation(arrowOffset);
  }, [arrowOffset]);

  const arrowAnimation = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowOffset.get() }],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.rollpe_primary,
          height: sectionHeight,
        },
      ]}
    >
      <Image
        source={require('@/assets/images/welcome/background.jpg')}
        contentFit="cover"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Image
          accessibilityLabel={t('common.brand')}
          accessible
          source={require('@/assets/images/welcome/logo.png')}
          contentFit="contain"
          style={styles.logo}
        />
        <Text numberOfLines={2} style={[styles.tagline, { color: colors.rollpe_secondary }]}>
          {t('welcome.tagline')}
        </Text>
        <PrimaryButton title={t('welcome.start')} onPress={onStart} style={styles.startButton} />
      </View>
      <View style={styles.scrollHint}>
        <Animated.View style={[styles.arrow, arrowAnimation]}>
          <Image
            source={require('@/assets/images/welcome/arrow-down.svg')}
            contentFit="contain"
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text style={[styles.scrollHintText, { color: colors.rollpe_gray }]}>
          {t('welcome.scroll')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: '42.7%',
    aspectRatio: 2,
  },
  tagline: {
    fontFamily: RollpeFonts.display,
    fontSize: 20,
    // Original font metrics: (820 ascent + 200 descent) / 1000, then iOS's 0.98 multiplier.
    lineHeight: 20 * 1.02 * 0.98,
    textAlign: 'center',
    marginTop: 20,
  },
  startButton: {
    alignSelf: 'stretch',
    marginTop: 60,
    marginHorizontal: 20,
  },
  scrollHint: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    width: 15,
    aspectRatio: 17 / 16,
  },
  scrollHintText: {
    fontFamily: RollpeFonts.display,
    fontSize: 15,
    textAlign: 'center',
  },
});
