import { Image } from 'expo-image';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTranslation } from '@/i18n';
import { useRollpeColors } from '@/constants/theme';

type BackButtonProps = Omit<PressableProps, 'children'>;

export function BackButton({ style, ...props }: BackButtonProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();

  return (
    <Pressable
      accessibilityLabel={t('common.back')}
      accessibilityRole="button"
      hitSlop={16}
      {...props}
      style={(state) => [styles.button, typeof style === 'function' ? style(state) : style]}>
      <Image
        source={require('@/assets/icons/icon_chevron_left.svg')}
        contentFit="contain"
        tintColor={colors.rollpe_secondary}
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 12,
    aspectRatio: 12 / 21,
  },
});
