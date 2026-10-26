import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { RollpeFonts } from '@/constants/theme';
import { useTranslation } from '@/i18n';

// Web dialogs stay in React so a blocking browser prompt cannot freeze the app surface.
export function HeartDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const confirm = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => { confirm.current?.focus(); }, []);
  return <AppModal visible onClose={() => onCancel?.()}>
    <View role="alertdialog" aria-modal accessibilityViewIsModal style={styles.dialog}>
      <Text style={styles.title}>{t('common.notice')}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttons}>
        {onCancel && <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}><Text style={styles.label}>{t('common.cancel')}</Text></Pressable>}
        <Pressable ref={confirm} accessibilityRole="button" onPress={onConfirm} style={styles.button}><Text style={styles.label}>{t('common.confirm')}</Text></Pressable>
      </View>
    </View>
  </AppModal>;
}
const styles = StyleSheet.create({
  dialog: { width: '100%', maxWidth: 360, alignSelf: 'center', padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  title: { fontFamily: RollpeFonts.semibold, fontSize: 20, color: '#181818', textAlign: 'center' },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, color: '#181818', marginTop: 16, textAlign: 'center' },
  buttons: { flexDirection: 'row', marginTop: 24, gap: 8 }, button: { flex: 1, padding: 12, alignItems: 'center' },
  label: { fontFamily: RollpeFonts.semibold, fontSize: 16, color: '#FF5656' },
});
