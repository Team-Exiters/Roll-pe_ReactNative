import { useRef, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

type AppDialogProps = {
  title?: string;
  message?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
};

export function AppDialog({ title, message, children, confirmLabel, cancelLabel, busy = false,
  onConfirm, onCancel, onClose = onCancel }: AppDialogProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const dialog = useRef<ComponentRef<typeof View>>(null);

  return <AppModal visible avoidKeyboard={Boolean(children)} onClose={() => { if (!busy) onClose?.(); }}
    onShow={() => { if (Platform.OS === 'web' && !children) dialog.current?.focus(); }}>
    <View ref={dialog} role="alertdialog" aria-modal tabIndex={children ? undefined : -1} accessibilityViewIsModal
      style={[styles.dialog, { backgroundColor: colors.rollpe_primary }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{title ?? t('common.notice')}</Text>
      {message && <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.rollpe_secondary }]}>{message}</Text>}
      {children}
      {busy && <ActivityIndicator accessibilityLabel={t('common.processing')} color={colors.rollpe_main} style={styles.spinner} />}
      <View style={styles.buttons}>
        {onCancel && <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }}
          onPress={onCancel} style={styles.button}>
          <Text style={[styles.label, { color: colors.rollpe_secondary, opacity: busy ? 0.5 : 1 }]}>{cancelLabel ?? t('common.cancel')}</Text>
        </Pressable>}
        <PrimaryButton title={confirmLabel ?? t('common.confirm')} textStyle={styles.label} disabled={busy} style={styles.button} onPress={onConfirm} />
      </View>
    </View>
  </AppModal>;
}

const styles = StyleSheet.create({
  dialog: { width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 16, padding: 20 },
  title: { fontFamily: RollpeFonts.display, fontSize: 20, textAlign: 'center' },
  message: { fontFamily: RollpeFonts.display, fontSize: 16, marginTop: 16, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 24 },
  button: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center' },
  spinner: { marginTop: 20 },
});
