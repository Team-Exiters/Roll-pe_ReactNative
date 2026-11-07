import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppDialog } from '@/components/ui/AppDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { getTokenState } from '@/features/sign-in/token-state';
import {
  inquiryCategories,
  inquiryError,
  sendInquiry,
  type InquiryCategory,
} from '@/features/support/api';
import { SupportLayout } from '@/features/support/components/SupportLayout';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function InquiryScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const { openSignIn, openMainScreen } = useAppNavigation();
  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [content, setContent] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(false);
  const submission = useRef<{ id: string; signature: string } | null>(null);
  const operation = useRef<AbortController | null>(null);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setReady(false);
      void getTokenState()
        .then((state) => {
          if (controller.signal.aborted) return;
          if (!state) {
            openSignIn();
            return;
          }
          setReady(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setMessage(t('common.genericError'));
        });
      return () => {
        controller.abort();
        operation.current?.abort();
        operation.current = null;
        setBusy(false);
      };
    }, [openSignIn, t]),
  );

  async function submit() {
    if (operation.current || completed || !ready) return;
    const draft = { category, content };
    const error = inquiryError(draft);
    if (error) {
      setMessage(error);
      return;
    }
    // Reuse the receipt for the same submission; edited drafts are separate inquiries.
    const signature = JSON.stringify({
      category,
      content: content.trim(),
    });
    if (submission.current?.signature !== signature) {
      submission.current = { id: randomUUID(), signature };
    }
    const controller = new AbortController();
    operation.current = controller;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await sendInquiry(draft, submission.current.id, controller.signal);
      if (!controller.signal.aborted) {
        setCompleted(true);
        setMessage(t('support.completed'));
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) openSignIn();
      else setMessage(cause instanceof Error ? cause.message : t('support.uncertain'));
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(false);
      }
    }
  }

  function closeMessage() {
    setMessage('');
    if (completed || !ready) {
      if (router.canGoBack()) router.back();
      else openMainScreen();
    }
  }

  return (
    <SupportLayout title={t('home.contact')}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contents}>
          <Text style={[styles.description, { color: colors.rollpe_secondary }]}>
            {t('support.description')}
          </Text>
          <Text style={[styles.label, { color: colors.rollpe_secondary }]}>
            {t('support.category')}
          </Text>
          <View style={styles.categories}>
            {inquiryCategories.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                aria-checked={value === category}
                accessibilityState={{ checked: value === category }}
                disabled={busy || completed}
                onPress={() => setCategory(value)}
                style={({ pressed }) => [
                  styles.category,
                  {
                    borderColor: value === category ? colors.rollpe_main : colors.rollpe_gray,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: colors.rollpe_main,
                      backgroundColor: value === category ? colors.rollpe_main : 'transparent',
                    },
                  ]}
                />
                <Text style={[styles.categoryText, { color: colors.rollpe_secondary }]}>
                  {t(`support.category.${value}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.rollpe_secondary }]}>
            {t('support.content')}
          </Text>
          <View
            style={[
              styles.inputFrame,
              { borderColor: content ? colors.rollpe_secondary : colors.rollpe_gray },
            ]}
          >
            <TextInput
              accessibilityLabel={t('support.content')}
              placeholder={t('support.placeholder')}
              placeholderTextColor={colors.rollpe_gray}
              multiline
              maxLength={2000}
              value={content}
              onChangeText={setContent}
              editable={!busy && !completed}
              textAlignVertical="top"
              style={[styles.input, { color: colors.rollpe_secondary }]}
            />
            <Text pointerEvents="none" style={[styles.count, { color: colors.rollpe_secondary }]}>
              {t('support.count', { count: content.length })}
            </Text>
          </View>
          <Text style={[styles.note, { color: colors.team_exiters }]}>
            {t('support.privacyNote')}
          </Text>
          <View style={styles.spacer} />
          <PrimaryButton
            title={t('support.submit')}
            disabled={!ready || busy || completed || Boolean(inquiryError({ category, content }))}
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      {Boolean(message) && (
        <AppDialog message={message} onConfirm={closeMessage} onClose={closeMessage} />
      )}
      {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
    </SupportLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contents: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  description: { fontFamily: RollpeFonts.display, fontSize: 18, lineHeight: 26, marginBottom: 12 },
  label: { fontFamily: RollpeFonts.display, fontSize: 20, marginTop: 24, marginBottom: 12 },
  categories: { gap: 8 },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  categoryText: { fontFamily: RollpeFonts.display, fontSize: 18 },
  inputFrame: { borderWidth: 2, borderRadius: 16 },
  input: {
    minHeight: 180,
    padding: 16,
    paddingBottom: 32,
    fontFamily: RollpeFonts.display,
    fontSize: 18,
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
  note: { fontFamily: RollpeFonts.display, fontSize: 14, lineHeight: 20, marginTop: 12 },
  spacer: { flex: 1, minHeight: 32 },
});
