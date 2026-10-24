import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { useTranslation } from '@/i18n';
import { useRollpeColors } from '@/constants/theme';

type SocialSignInButtonProps = {
  provider: 'kakao' | 'google' | 'apple';
  onPress?: () => void;
  disabled?: boolean;
};

export function SocialSignInButton({ provider, onPress, disabled = false }: SocialSignInButtonProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const providers = {
    kakao: {
      label: t('auth.kakaoButton'),
      source: require('@/assets/icons/icon_kakao.svg'),
      backgroundColor: colors.kakao,
      aspectRatio: 20 / 19,
    },
    google: {
      label: t('auth.googleButton'),
      source: require('@/assets/icons/icon_google.svg'),
      backgroundColor: colors.rollpe_white,
      aspectRatio: 1,
    },
    apple: {
      label: t('auth.appleButton'),
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
      accessibilityHint={!onPress ? t('common.unavailable') : undefined}
      accessibilityState={{ disabled: disabled || !onPress }}
      disabled={disabled || !onPress}
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
