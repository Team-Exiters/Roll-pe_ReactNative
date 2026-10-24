import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { createRollpe, fetchRollpeOptions, type RollpeOptions } from '@/features/create-rollpe/api';
import { DateField } from '@/features/create-rollpe/components/DateField';
import { OptionPicker } from '@/features/create-rollpe/components/OptionPicker';
import { PickerField } from '@/features/create-rollpe/components/PickerField';
import { RecipientPicker } from '@/features/create-rollpe/components/RecipientPicker';
import { RollpePreview } from '@/features/create-rollpe/components/RollpePreview';
import { creationError, receivingDateLimits, type CreateRollpeValues } from '@/features/create-rollpe/validation';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';

export default function CreateRollpeScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const [values, setValues] = useState<CreateRollpeValues>(() => ({
    title: '', ratio: null, theme: null, size: null, isPrivate: true, password: '',
    receivingDate: receivingDateLimits().minimum, recipient: null,
  }));
  const [options, setOptions] = useState<RollpeOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const creationRequest = useRef<AbortController | null>(null);
  const limits = receivingDateLimits();

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; creationRequest.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchRollpeOptions(controller.signal).then(result => {
      if (!controller.signal.aborted) setOptions(result);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AuthenticationRequiredError) router.replace('/sign-in');
      else setOptionsError(error instanceof Error ? error.message : t('create.optionsFailed'));
    });
    return () => controller.abort();
  }, [attempt, router, t]);

  function change<K extends keyof CreateRollpeValues>(key: K, value: CreateRollpeValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
  }
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }
  function showMessage(title: string, message: string, onConfirm?: () => void) {
    if (Platform.OS === 'web') { window.alert(message); onConfirm?.(); }
    else Alert.alert(title, message, [{ text: t('common.confirm'), onPress: onConfirm }]);
  }
  function failure(error: unknown) {
    if (!active.current) return;
    if (error instanceof AuthenticationRequiredError) {
      setSearchOpen(false);
      router.replace('/sign-in');
    } else showMessage(t('common.error'), error instanceof Error ? error.message : t('common.genericError'));
  }
  async function submit() {
    if (pending.current) return;
    const error = creationError(values);
    if (error) { showMessage(t('common.error'), error); return; }
    pending.current = true;
    const controller = new AbortController();
    creationRequest.current = controller;
    setLoading(true);
    try {
      const message = await createRollpe(values, controller.signal);
      if (active.current) showMessage(t('common.notice'), message, () => { if (active.current) goBack(); });
    } catch (error) { failure(error); }
    finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  const titleStyle = [styles.sectionTitle, { color: colors.rollpe_secondary }];
  const descriptionStyle = [styles.description, { color: colors.rollpe_secondary }];
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingBottom: safeArea('bottom') }]}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingTop: safeArea('top', 88), paddingBottom: 40 }}>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.rollpe_secondary }]}>{t('common.createRollpe')}</Text>
        <View style={[styles.inset, styles.titleSection]}>
          <Text style={titleStyle}>{t('create.title')}</Text>
          <RoundedBorderTextField accessibilityLabel={t('create.titleLabel')} value={values.title} maxLength={20} editable={!loading}
            onChangeText={value => change('title', value)} style={styles.field} />
        </View>
        {optionsError ? <View style={[styles.inset, styles.section]}>
          <Text accessibilityRole="alert" style={descriptionStyle}>{optionsError}</Text>
          <PrimaryButton title={t('common.retry')} style={styles.field} onPress={() => {
            setOptionsError(''); setAttempt(value => value + 1);
          }} />
        </View> : null}
        {(['ratios', 'themes', 'sizes'] as const).map((key, index) => {
          const field = (['ratio', 'theme', 'size'] as const)[index];
          return <View key={key} style={styles.section}>
            <Text style={[titleStyle, styles.inset]}>{[t('create.ratio'), t('create.theme'), t('create.size')][index]}</Text>
            <View style={styles.field}>
              <OptionPicker choices={options?.[key] ?? []} selected={values[field]} disabled={loading}
                onSelect={choice => change(field, choice)} />
            </View>
          </View>;
        })}
        <View style={[styles.section, styles.inset]}>
          <Text style={titleStyle}>{t('create.privacy')}</Text>
          <Text style={[descriptionStyle, styles.descriptionGap]}>{t('create.privacyHelp')}</Text>
          <View style={[styles.privacy, styles.field]}>
            {[t('create.public'), t('create.private')].map((label, index) => <Pressable key={label} accessibilityRole="radio"
              accessibilityLabel={label} accessibilityState={{ checked: values.isPrivate === Boolean(index), disabled: loading }}
              disabled={loading} onPress={() => change('isPrivate', Boolean(index))}
              style={[styles.segment, values.isPrivate === Boolean(index) && { backgroundColor: colors.rollpe_primary }]}>
              <Text style={[styles.segmentText, { color: colors.rollpe_secondary }]}>{label}</Text>
            </Pressable>)}
          </View>
          {values.isPrivate && <RoundedBorderTextField accessibilityLabel={t('create.password')} placeholder={t('common.password')}
            value={values.password} editable={!loading} onChangeText={value => change('password', value)} style={styles.password} />}
        </View>
        <View style={[styles.section, styles.inset]}>
          <Text style={titleStyle}>{t('create.delivery')}</Text>
          <View style={styles.field}><DateField value={values.receivingDate} minimum={limits.minimum} maximum={limits.maximum}
            disabled={loading} onChange={value => change('receivingDate', value)} /></View>
        </View>
        <View style={[styles.section, styles.inset]}>
          <Text style={titleStyle}>{t('create.recipient')}</Text>
          <View style={styles.field}><PickerField label={t('create.selectRecipient')} disabled={loading} onPress={() => setSearchOpen(true)}
            value={values.recipient ? `${values.recipient.name}(${values.recipient.identifyCode})` : ''} /></View>
        </View>
        <View style={[styles.section, styles.inset]}>
          <Text style={titleStyle}>{t('create.preview')}</Text>
          <Text style={[descriptionStyle, styles.descriptionGap]}>
            {values.size ? t('create.maxParticipants', { count: values.size.query.max }) : ' '}
          </Text>
        </View>
        {values.ratio && values.theme && values.size && <RollpePreview title={values.title}
          ratio={values.ratio.name} theme={values.theme.name} size={values.size.name} />}
        <PrimaryButton title={t('create.submit')} disabled={!options || loading || Boolean(creationError(values))}
          style={[styles.inset, styles.create]} onPress={() => { void submit(); }} />
      </ScrollView>
    </KeyboardAvoidingView>
    <View style={[styles.navigation, { top: safeArea('top'), backgroundColor: colors.rollpe_primary }]}>
      <BackButton disabled={loading} onPress={goBack} style={styles.back} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.goHome')} disabled={loading} onPress={() => router.dismissTo('/home')}>
        <Image source={require('@/assets/images/welcome/logo.png')} accessible={false} contentFit="contain" style={styles.logo} />
      </Pressable>
    </View>
    {searchOpen && <RecipientPicker onClose={() => setSearchOpen(false)} onError={failure}
      onSelect={recipient => { change('recipient', recipient); setSearchOpen(false); }} />}
    {(loading || (!options && !optionsError)) && <LoadingView accessibilityLabel={loading ? t('create.creating') : t('create.optionsLoading')} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, inset: { marginHorizontal: 20 },
  pageTitle: { fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  titleSection: { marginTop: 52 }, section: { marginTop: 40 },
  sectionTitle: { fontFamily: RollpeFonts.display, fontSize: 20 },
  description: { fontFamily: RollpeFonts.display, fontSize: 12 }, descriptionGap: { marginTop: 8 },
  field: { marginTop: 20 }, password: { marginTop: 12 },
  privacy: { flexDirection: 'row', padding: 8, borderRadius: 16, backgroundColor: '#F1F1F1' },
  segment: { flex: 1, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  segmentText: { fontFamily: RollpeFonts.display, fontSize: 16 }, create: { marginTop: 52 },
  navigation: { position: 'absolute', left: 20, right: 20, height: 68, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 23.5 }, logo: { width: 48, height: 24 },
});
