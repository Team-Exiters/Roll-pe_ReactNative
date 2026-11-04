import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { DateField } from '@/features/create-rollpe/components/DateField';
import { RollpeActionError } from '@/features/rollpe-info/api';
import { RollpeActionDialog } from '@/features/rollpe-info/components/RollpeActionDialog';
import {
  canDeleteRollpe,
  canSendRollpe,
  type RollpeAction,
  type RollpeInfo,
} from '@/features/rollpe-info/model';
import {
  rollpeSettingsError,
  settingsChanged,
  settingsDateLimits,
  updateRollpeSettings,
} from '@/features/rollpe-info/settings';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function RollpeManagementModal({
  paper,
  userId,
  onClose,
  onReload,
  onCompleted,
  onAuthenticationRequired,
}: {
  paper: RollpeInfo;
  userId: number;
  onClose: () => void;
  onReload: () => void;
  onCompleted: () => void;
  onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation(),
    colors = useRollpeColors(),
    { height } = useWindowDimensions();
  const [values, setValues] = useState({
    isPrivate: !paper.viewStat,
    password: '',
    receivingDate: paper.receive.receivingDate,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reload, setReload] = useState(false),
    [saved, setSaved] = useState(false);
  const [action, setAction] = useState<RollpeAction | null>(null);
  const operation = useRef<AbortController | null>(null),
    pending = useRef(false);
  useEffect(() => () => operation.current?.abort(), []);
  const limits = settingsDateLimits();
  const disabled = busy || saved || reload;
  function close() {
    if (!pending.current) {
      if (saved || reload) onReload();
      else onClose();
    }
  }
  async function submit() {
    if (pending.current) return;
    const validation = rollpeSettingsError(paper, values);
    if (validation) {
      setError(validation);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    operation.current = controller;
    try {
      await updateRollpeSettings(paper, userId, values, controller.signal);
      if (!controller.signal.aborted) {
        setValues((value) => ({ ...value, password: '' }));
        setSaved(true);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else {
        setError(cause instanceof Error ? cause.message : t('settings.uncertain'));
        setReload(cause instanceof RollpeActionError);
      }
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (action)
    return (
      <RollpeActionDialog
        action={action}
        paper={paper}
        userId={userId}
        onClose={() => setAction(null)}
        onCompleted={onCompleted}
        onReload={onReload}
        onAuthenticationRequired={onAuthenticationRequired}
      />
    );
  return (
    <AppModal visible onClose={close} avoidKeyboard>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.rollpe_primary,
            height: Math.min(Math.max(height * 0.62, 640), height - 80),
          },
        ]}
      >
        <View style={styles.heading}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.close')}
            hitSlop={12}
            disabled={busy}
            onPress={close}
            style={({ pressed }) => [styles.close, { opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}
          >
            <Image
              source={require('@/assets/images/home/close.svg')}
              tintColor={colors.rollpe_secondary}
              style={styles.icon}
              accessible={false}
            />
          </Pressable>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.rollpe_secondary }]}
          >
            {t('settings.title')}
          </Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.privacySection}>
            <Text style={[styles.label, { color: colors.rollpe_secondary }]}>
              {t('settings.privacy')}
            </Text>
            <View style={styles.segments}>
              {[false, true].map((isPrivate) => (
                <Pressable
                  key={String(isPrivate)}
                  accessibilityRole="radio"
                  accessibilityLabel={t(isPrivate ? 'create.private' : 'create.public')}
                  aria-checked={values.isPrivate === isPrivate}
                  accessibilityState={{ checked: values.isPrivate === isPrivate, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (values.isPrivate !== isPrivate) {
                      setValues((value) => ({ ...value, isPrivate, password: '' }));
                      setError('');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.segment,
                    values.isPrivate === isPrivate && { backgroundColor: colors.rollpe_primary },
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.segmentLabel, { color: colors.rollpe_secondary }]}>
                    {t(isPrivate ? 'create.private' : 'create.public')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {values.isPrivate && (
              <>
                <RoundedBorderTextField
                  accessibilityLabel={t('create.password')}
                  placeholder={paper.viewStat ? t('common.password') : t('settings.keepPassword')}
                  accessibilityHint={!paper.viewStat ? t('settings.passwordHelp') : undefined}
                  value={values.password}
                  onChangeText={(password) => {
                    setValues((value) => ({ ...value, password }));
                    setError('');
                  }}
                  maxLength={50}
                  editable={!disabled}
                  secureTextEntry
                  autoComplete="off"
                  style={styles.password}
                />
                {!paper.viewStat && (
                  <Text style={[styles.help, { color: colors.rollpe_secondary }]}>
                    {t('settings.passwordHelp')}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.dateSection}>
            <Text style={[styles.label, { color: colors.rollpe_secondary }]}>
              {t('settings.delivery')}
            </Text>
            <View style={styles.date}>
              <DateField
                value={values.receivingDate}
                minimum={
                  paper.receive.receivingDate < limits.minimum
                    ? paper.receive.receivingDate
                    : limits.minimum
                }
                maximum={
                  paper.receive.receivingDate > limits.maximum
                    ? paper.receive.receivingDate
                    : limits.maximum
                }
                disabled={disabled}
                onChange={(receivingDate) => {
                  setValues((value) => ({ ...value, receivingDate }));
                  setError('');
                }}
              />
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {error ? (
            <Text accessibilityRole="alert" style={[styles.message, { color: colors.rollpe_main }]}>
              {error}
            </Text>
          ) : null}
          {saved && (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.message, { color: colors.rollpe_secondary }]}
            >
              {t('settings.saved')}
            </Text>
          )}
          <PrimaryButton
            title={t(
              saved
                ? 'common.confirm'
                : reload
                  ? 'settings.reload'
                  : busy
                    ? 'common.processing'
                    : 'settings.save',
            )}
            disabled={
              busy ||
              (!saved &&
                !reload &&
                (!settingsChanged(paper, values) || Boolean(rollpeSettingsError(paper, values))))
            }
            onPress={() => {
              if (saved || reload) close();
              else void submit();
            }}
          />
          {!saved && !reload && (
            <View style={styles.actions}>
              {(['delete', 'send'] as const).map((action) => {
                const enabled =
                  !busy &&
                  (action === 'delete'
                    ? canDeleteRollpe(paper, userId)
                    : canSendRollpe(paper, userId));
                return (
                  <OutlineButton
                    key={action}
                    disabled={!enabled}
                    onPress={() => setAction(action)}
                    style={styles.actionButton}
                    title={t(action === 'delete' ? 'info.deleteAction' : 'settings.sendEarly')}
                    accessibilityHint={
                      action === 'send' && !paper.receive.receiver
                        ? t('info.sendRecipientRequired')
                        : undefined
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  heading: { marginTop: 28, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', left: 0 },
  icon: { width: 20, height: 20 },
  title: { fontFamily: RollpeFonts.display, fontSize: 28 },
  label: { fontFamily: RollpeFonts.display, fontSize: 20 },
  privacySection: { marginTop: 28 },
  segments: {
    flexDirection: 'row',
    backgroundColor: '#7676801F',
    borderRadius: 8,
    padding: 2,
    marginTop: 20,
  },
  segment: { flex: 1, padding: 8, alignItems: 'center', borderRadius: 6 },
  segmentLabel: { fontFamily: RollpeFonts.semibold, fontSize: 14 },
  password: { marginTop: 12 },
  help: { marginTop: 8, fontFamily: RollpeFonts.display, fontSize: 14 },
  dateSection: { marginTop: 40 },
  date: { marginTop: 20 },
  message: { fontFamily: RollpeFonts.display, fontSize: 16 },
  footer: { padding: 20, gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1 },
});
