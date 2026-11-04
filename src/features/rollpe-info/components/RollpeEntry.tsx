import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AppDialog } from '@/components/ui/AppDialog';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export function RollpeEntry({
  title,
  isPublic,
  invited = false,
  error,
  busy,
  onSubmit,
  onCancel,
}: {
  title: string;
  isPublic: boolean;
  invited?: boolean;
  error?: string;
  busy: boolean;
  onSubmit: (password?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [password, setPassword] = useState('');
  const needsPassword = !isPublic && !invited;
  return (
    <AppDialog
      title={t(invited ? 'home.invited' : isPublic ? 'common.notice' : 'info.joinTitle')}
      message={
        invited
          ? t('invitations.confirmAccept', { title })
          : isPublic
            ? t('info.confirmJoin', { title })
            : t('info.enterPassword')
      }
      busy={busy}
      confirmLabel={invited ? t('invitations.accept') : undefined}
      onCancel={onCancel}
      onConfirm={() => onSubmit(needsPassword ? password : undefined)}
    >
      {(needsPassword || error) && (
        <View>
          {needsPassword && (
            <RoundedBorderTextField
              accessibilityLabel={t('create.password')}
              placeholder={t('common.password')}
              secureTextEntry
              autoFocus
              maxLength={50}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!busy) onSubmit(password);
              }}
              style={styles.input}
            />
          )}
          {Boolean(error) && (
            <Text
              accessibilityRole="alert"
              style={[styles.description, { color: colors.rollpe_main }]}
            >
              {error}
            </Text>
          )}
        </View>
      )}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  description: {
    fontFamily: RollpeFonts.display,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  input: { marginTop: 20 },
});
