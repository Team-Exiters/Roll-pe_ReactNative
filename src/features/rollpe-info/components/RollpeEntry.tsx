import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AppDialog } from '@/components/ui/AppDialog';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export function RollpeEntry({ title, isPublic, error, busy, onSubmit, onCancel }: {
  title: string; isPublic: boolean; error?: string; busy: boolean;
  onSubmit: (password?: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [password, setPassword] = useState('');
  return <AppDialog title={t(isPublic ? 'common.notice' : 'info.joinTitle')}
    message={isPublic ? t('info.confirmJoin', { title }) : t('info.enterPassword')} busy={busy}
    onCancel={onCancel} onConfirm={() => onSubmit(isPublic ? undefined : password)}>
    {(!isPublic || error) && <View>
      {!isPublic && <RoundedBorderTextField accessibilityLabel={t('create.password')} placeholder={t('common.password')}
        secureTextEntry autoFocus maxLength={50} value={password} onChangeText={setPassword} editable={!busy}
        returnKeyType="go" onSubmitEditing={() => { if (!busy) onSubmit(password); }} style={styles.input} />}
      {error && <Text accessibilityRole="alert" style={[styles.description, { color: colors.rollpe_main }]}>{error}</Text>}
    </View>}
  </AppDialog>;
}

const styles = StyleSheet.create({
  description: { fontFamily: RollpeFonts.display, fontSize: 16, marginTop: 16, textAlign: 'center' },
  input: { marginTop: 20 },
});
