import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';
import { AppModal } from '@/components/ui/AppModal';

export function RollpeEntry({ title, isPublic, error, busy, onSubmit, onCancel }: {
  title: string; isPublic?: boolean; error?: string; busy: boolean;
  onSubmit: (password?: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [password, setPassword] = useState('');
  return <AppModal visible avoidKeyboard onClose={() => { if (!busy) onCancel(); }}>
    <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.rollpe_primary }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
        {t(isPublic ? 'common.notice' : 'info.joinTitle')}
      </Text>
      <Text style={[styles.description, { color: colors.rollpe_secondary }]}>
        {isPublic ? t('info.confirmJoin', { title }) : t(isPublic === false ? 'info.enterPassword' : 'info.joinExplanation')}
      </Text>
      {!isPublic && <RoundedBorderTextField accessibilityLabel={t('create.password')} placeholder={t('common.password')}
        secureTextEntry autoFocus maxLength={50} value={password} onChangeText={setPassword} editable={!busy}
        returnKeyType="go" onSubmitEditing={() => { if (!busy) onSubmit(password); }} style={styles.input} />}
      {error && <Text accessibilityRole="alert" style={[styles.description, { color: colors.rollpe_main }]}>{error}</Text>}
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: colors.rollpe_secondary }]}>{t('common.cancel')}</Text>
        </Pressable>
        <PrimaryButton title={t('common.confirm')} disabled={busy} style={styles.confirm}
          onPress={() => onSubmit(isPublic ? undefined : password)} />
      </View>
    </View>
  </AppModal>;
}

const styles = StyleSheet.create({
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 16, padding: 20 },
  title: { fontFamily: RollpeFonts.semibold, fontSize: 20, textAlign: 'center' },
  description: { fontFamily: RollpeFonts.regular, fontSize: 16, marginTop: 16, textAlign: 'center' },
  input: { marginTop: 20 }, buttons: { flexDirection: 'row', gap: 8, marginTop: 24 },
  cancel: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontFamily: RollpeFonts.semibold, fontSize: 16 }, confirm: { flex: 1 },
});
