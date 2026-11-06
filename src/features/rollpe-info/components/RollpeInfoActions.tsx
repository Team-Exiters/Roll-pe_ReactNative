import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useRollpeColors } from '@/constants/theme';
import type { rollpeRole } from '@/features/rollpe-info/model';
import { useTranslation } from '@/i18n';

type RollpeInfoActionsProps = {
  role: ReturnType<typeof rollpeRole> | null;
  disabled: boolean;
  canSaveImage: boolean;
  canReport?: boolean;
  onSaveImage: () => void;
  onManage: () => void;
  onShare: () => void;
  onLeave: () => void;
  onReport: () => void;
};

export function RollpeInfoActions({
  role,
  disabled,
  canSaveImage,
  canReport = true,
  onSaveImage,
  onManage,
  onShare,
  onLeave,
  onReport,
}: RollpeInfoActionsProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();

  const reportButton = canReport ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('info.report')}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onReport}
      style={({ pressed }) => [
        styles.report,
        { borderColor: colors.rollpe_main, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <Image
        source={require('@/assets/icons/icon_siren.svg')}
        accessible={false}
        contentFit="contain"
        style={styles.reportIcon}
      />
    </Pressable>
  ) : null;
  if (role === 'receiver') {
    return (
      <View style={styles.row}>
        <PrimaryButton
          title={t('info.saveImage')}
          style={styles.button}
          disabled={!canSaveImage}
          onPress={onSaveImage}
        />
        {reportButton}
      </View>
    );
  }
  if (role === 'host') {
    return (
      <View style={styles.row}>
        <OutlineButton
          title={t('settings.open')}
          disabled={disabled}
          style={styles.button}
          onPress={onManage}
        />
        <PrimaryButton
          title={t('info.share')}
          disabled={disabled}
          style={styles.button}
          onPress={onShare}
        />
      </View>
    );
  }
  if (role === 'participant') {
    return (
      <View style={styles.row}>
        <OutlineButton
          title={t('participants.leave')}
          disabled={disabled}
          style={styles.button}
          onPress={onLeave}
        />
        {reportButton}
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  report: {
    width: 52,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIcon: { width: 20, height: 20 },
});
