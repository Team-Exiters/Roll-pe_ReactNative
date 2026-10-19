import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { useRollpeColors } from '@/constants/theme';

type SocialSignInButtonProps = {
  provider: 'kakao' | 'google' | 'apple';
  onPress?: () => void;
};

export function SocialSignInButton({ provider, onPress }: SocialSignInButtonProps) {
  const colors = useRollpeColors();
  const providers = {
    kakao: {
      label: '카카오로 로그인',
      source: require('@/assets/icons/icon_kakao.svg'),
      backgroundColor: colors.kakao,
      aspectRatio: 20 / 19,
    },
    google: {
      label: 'Google로 로그인',
      source: require('@/assets/icons/icon_google.svg'),
      backgroundColor: colors.rollpe_white,
      aspectRatio: 1,
    },
    apple: {
      label: 'Apple로 로그인',
      source: require('@/assets/icons/icon_apple.svg'),
      backgroundColor: colors.real_black,
      aspectRatio: 1,
    },
  };
  const config = providers[provider];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={config.label}
      accessibilityHint={!onPress ? '현재 사용할 수 없습니다.' : undefined}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: config.backgroundColor },
        provider === 'google' && { borderWidth: 1, borderColor: colors.real_black },
      ]}>
      <Image
        source={config.source}
        contentFit="contain"
        accessible={false}
        style={[styles.icon, { aspectRatio: config.aspectRatio }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 20,
  },
});
