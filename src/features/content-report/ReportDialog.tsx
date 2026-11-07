import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppDialog } from '@/components/ui/AppDialog';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import {
  reportReasons,
  submitContentReport,
  type ReportReason,
  type ReportTarget,
} from '@/features/content-report/api';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function ReportDialog({
  target,
  inline = false,
  onClose,
  onAuthenticationRequired,
}: {
  target: ReportTarget;
  inline?: boolean;
  onClose: () => void;
  onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  async function submit() {
    if (operation.current) return;
    if (!reason) {
      setError(t('report.selectReason'));
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError('');
    const controller = new AbortController();
    operation.current = controller;
    try {
      const message = await submitContentReport(target, reason, description, controller.signal);
      if (!controller.signal.aborted) setReceipt(message);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else setError(cause instanceof Error ? cause.message : t('report.uncertain'));
    } finally {
      if (!controller.signal.aborted) {
        operation.current = null;
        setBusy(false);
      }
    }
  }
  const dialog = (
    <AppDialog
      title={t('report.title')}
      message={receipt || t('report.description')}
      busy={busy}
      inline={inline}
      confirmLabel={t(receipt ? 'common.confirm' : 'report.submit')}
      onConfirm={() => {
        if (receipt) onClose();
        else void submit();
      }}
      onCancel={receipt ? undefined : onClose}
      onClose={onClose}
    >
      {!receipt && (
        <ScrollView
          style={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {reportReasons.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              aria-checked={reason === value}
              accessibilityState={{ checked: reason === value }}
              onPress={() => {
                Keyboard.dismiss();
                setReason(value);
                setError('');
              }}
              style={({ pressed }) => [
                styles.reason,
                {
                  borderColor: reason === value ? colors.rollpe_main : colors.rollpe_gray,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: colors.rollpe_main,
                    backgroundColor: reason === value ? colors.rollpe_main : 'transparent',
                  },
                ]}
              />
              <Text style={[styles.text, { color: colors.rollpe_secondary }]}>
                {t(`report.reason.${value}`)}
              </Text>
            </Pressable>
          ))}
          <View style={[styles.inputFrame, { borderColor: colors.rollpe_gray }]}>
            <TextInput
              accessibilityLabel={t('report.details')}
              placeholder={t('report.details')}
              placeholderTextColor={colors.rollpe_gray}
              multiline
              maxLength={500}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
              style={[styles.input, { color: colors.rollpe_secondary }]}
            />
            <Text pointerEvents="none" style={[styles.count, { color: colors.rollpe_secondary }]}>
              {t('report.count', { count: Array.from(description).length })}
            </Text>
          </View>
          {Boolean(error) && (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.rollpe_main }]}>
              {error}
            </Text>
          )}
        </ScrollView>
      )}
    </AppDialog>
  );
  // Heart details already own an iOS Modal. Move only this form when its keyboard opens.
  return inline ? (
    <KeyboardAvoidingView
      behavior="padding"
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      <View style={styles.overlay}>{dialog}</View>
    </KeyboardAvoidingView>
  ) : (
    dialog
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1 },
  form: { maxHeight: 340, marginTop: 16 },
  reason: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  text: { flexShrink: 1, fontFamily: RollpeFonts.display, fontSize: 16 },
  inputFrame: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  input: {
    minHeight: 72,
    borderRadius: 8,
    padding: 8,
    paddingBottom: 28,
    fontFamily: RollpeFonts.display,
    fontSize: 16,
  },
  count: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    fontFamily: RollpeFonts.display,
    fontSize: 12,
    lineHeight: 14,
    includeFontPadding: false,
  },
  error: { marginTop: 8, fontFamily: RollpeFonts.display, fontSize: 14 },
});
