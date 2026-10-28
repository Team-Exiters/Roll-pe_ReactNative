import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/ui/AppModal';
import { AppDialog } from '@/components/ui/AppDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { RollpeFonts } from '@/constants/theme';
import { deleteHeart, fetchHeartColors, HeartMutationError, saveHeart } from '@/features/rollpe-content/api';
import { cleanHeartContent, heartDraftError, normalizeHeartColor, reportHeartUrl, type HeartColor } from '@/features/rollpe-content/model';
import { HeartHistoryContent } from '@/features/rollpe-content/components/HeartHistoryModal';
import type { RollpeHeart, RollpeInfo } from '@/features/rollpe-info/model';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function HeartModal({ paper, user, index, heart, onClose, onChanged, onAuthenticationRequired }: {
  paper: RollpeInfo; user: { id: number; identifyCode: string | null }; index: number; heart?: RollpeHeart;
  onClose: () => void; onChanged: () => void; onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation();
  const safeArea = useSafeAreaSpacing(), insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(!heart);
  const [content, setContent] = useState(heart?.content ?? '');
  const [color, setColor] = useState(normalizeHeartColor(heart?.color) ?? '');
  const [colors, setColors] = useState<HeartColor[]>([]);
  const [colorsError, setColorsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [textHeight, setTextHeight] = useState(112);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void; onCancel?: () => void } | null>(null);
  const [loaded, fontError] = useFonts({ previewMemo: require('@/assets/fonts/NanumPen.otf') });
  const active = useRef(true), pending = useRef(false), mutation = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    void fetchHeartColors(paper.theme === '추모', controller.signal).then(value => {
      if (!controller.signal.aborted) { setColors(value); setColorsError(false); }
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else setColorsError(true);
    });
    return () => controller.abort();
  }, [editing, paper.theme, attempt, onAuthenticationRequired]);

  function notice(message: string, after?: () => void) {
    if (!active.current) return;
    if (Platform.OS === 'web') setDialog({ message, onConfirm: () => { setDialog(null); after?.(); } });
    else Alert.alert(t('common.notice'), message, [{ text: t('common.confirm'), onPress: after }], { cancelable: false });
  }
  function confirm(message: string): Promise<boolean> {
    if (Platform.OS === 'web') return new Promise(resolve => setDialog({ message,
      onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); },
    }));
    return new Promise(resolve => Alert.alert(t('common.notice'), message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('common.confirm'), onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  }
  async function run(action: (signal: AbortSignal) => Promise<string>, confirmation: string) {
    if (pending.current) return;
    pending.current = true;
    let handingOff = false;
    try {
      if (!await confirm(confirmation) || !active.current) return;
      setBusy(true);
      const controller = new AbortController(); mutation.current = controller;
      const message = await action(controller.signal);
      if (active.current) { handingOff = true; notice(message, onChanged); }
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else if (cause instanceof HeartMutationError && cause.reload) { handingOff = true; notice(cause.message, onChanged); }
      else notice(cause instanceof Error ? cause.message : t('heart.failed'));
    } finally {
      if (!handingOff) { pending.current = false; if (active.current) setBusy(false); }
    }
  }
  function save() {
    const draft = { content, color };
    const error = heartDraftError(draft);
    if (error) { notice(error); return; }
    if (!colors.some(value => value.value === color)) { notice(t('heart.selectColor')); return; }
    void run(signal => saveHeart(paper.id, index, draft, heart?.id, signal), t(heart ? 'heart.confirmEdit' : 'heart.confirmWrite'));
  }
  const width = Math.max(0, Math.min(size.width - 40, (size.height - insets.top - insets.bottom - (editing ? 160 : 80)) * 7 / 8));
  const canEdit = heart?.author.id === user.id;
  const canDelete = canEdit || paper.host.id === user.id;
  const canReport = Boolean(heart && !canEdit);
  const edited = (heart?.revisionCount ?? 0) > 0;
  const authorLine = <Text style={styles.memoText}>{'- '}{heart?.author.name}
    {edited && <Text style={[styles.editedText, canDelete && styles.historyLink]}>{t('history.edited')}</Text>}
  </Text>;
  return <AppModal visible avoidKeyboard={!history} onClose={() => { if (history) setHistory(false); else if (dialog) dialog.onCancel?.(); else if (!pending.current) onClose(); }} contentStyle={styles.frame}>
    {history && heart ? <View style={styles.historyFrame}><HeartHistoryContent code={heart.code} onClose={() => setHistory(false)} onAuthenticationRequired={onAuthenticationRequired} /></View>
      : <View style={styles.screen} onLayout={({ nativeEvent: { layout } }) => setSize({ width: layout.width, height: layout.height })}>
      <View aria-hidden={Boolean(dialog)} importantForAccessibility={dialog ? 'no-hide-descendants' : 'auto'} style={styles.body}>
        {loaded && width > 0 ? <>
          <View style={[styles.memo, { width, height: width * 8 / 7, backgroundColor: color || '#AAAAAA' }]}>
            {editing ? <View style={styles.inputFrame}><TextInput accessibilityLabel={t('heart.contentLabel')}
              placeholder={t('heart.placeholder')} placeholderTextColor="#181818" value={content} editable={!busy}
              onChangeText={value => setContent(cleanHeartContent(value))} multiline autoCorrect={false} spellCheck={false} underlineColorAndroid="transparent"
              autoCapitalize="none" textAlignVertical="center" onContentSizeChange={event => setTextHeight(event.nativeEvent.contentSize.height)}
              style={[styles.memoText, styles.input, { height: Math.min(Math.max(112, textHeight), width * 8 / 7 - 32) }]} />
            </View> : <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.readContents} style={styles.read}>
                <Text style={styles.memoText}>{heart?.content}</Text>
                {edited && canDelete ? <Pressable accessibilityRole="button" accessibilityLabel={t('history.title')} onPress={() => setHistory(true)}>
                  {authorLine}
                </Pressable> : authorLine}
              </ScrollView>
              <View style={[styles.actions, !canDelete && { justifyContent: 'center' }]}>
                {canEdit && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(true)}><Text style={styles.actionText}>{t('heart.edit')}</Text></Pressable>}
                {canReport && <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
                  void (async () => {
                    try { if (heart) await Linking.openURL(reportHeartUrl(paper.code, heart.code, user.identifyCode ?? '')); }
                    catch { notice(t('info.reportFailed')); }
                  })();
                }}><Text style={styles.actionText}>{t('heart.report')}</Text></Pressable>}
                {canDelete && <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
                  if (heart) void run(signal => deleteHeart(heart.code, signal), t('heart.confirmDelete'));
                }}><Text style={[styles.actionText, !canEdit && styles.danger]}>{t('heart.delete')}</Text></Pressable>}
              </View>
            </>}
          </View>
          {editing && <View style={styles.palette}>
            {colorsError ? <Pressable accessibilityRole="button" onPress={() => { setColorsError(false); setAttempt(value => value + 1); }}>
              <Text style={styles.whiteText}>{t('heart.colorsFailed')} {t('common.retry')}</Text>
            </Pressable> : !colors.length ? <ActivityIndicator color="#FFFFFF" accessibilityLabel={t('heart.colorsLoading')} />
              : <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
                {colors.map(value => <Pressable key={value.id} accessibilityRole="radio" accessibilityLabel={t('heart.colorLabel', { color: value.value })}
                  aria-checked={color === value.value} accessibilityState={{ checked: color === value.value, disabled: busy }} disabled={busy}
                  onPress={() => setColor(value.value)} style={[styles.swatch, { backgroundColor: value.value }]} />)}
              </ScrollView>}
          </View>}
        </> : fontError ? <Text style={styles.whiteText}>{t('create.fontFailed')}</Text> : <ActivityIndicator color="#FFFFFF" />}
      </View>
      <View pointerEvents={dialog ? 'none' : 'box-none'} aria-hidden={Boolean(dialog)} importantForAccessibility={dialog ? 'no-hide-descendants' : 'auto'} style={[styles.navigation, { top: safeArea('top', 20) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('heart.close')} disabled={busy} hitSlop={12} onPress={onClose}>
          <Image source={require('@/assets/images/home/close.svg')} tintColor="#FFFFFF" contentFit="contain" accessible={false} style={styles.close} />
        </Pressable>
        {editing && <Pressable accessibilityRole="button" disabled={busy || !loaded || !colors.length} hitSlop={12} onPress={save}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>}
      </View>
      {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
      {dialog && <AppDialog {...dialog} />}
    </View>}
  </AppModal>;
}
const styles = StyleSheet.create({
  historyFrame: { flex: 1, justifyContent: 'center', padding: 20 },
  screen: { flex: 1 }, frame: { padding: 0 }, body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navigation: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 20, height: 20 }, done: { fontFamily: RollpeFonts.display, fontSize: 20, color: '#FFFFFF' },
  memo: { overflow: 'hidden' }, inputFrame: { flex: 1, padding: 16, justifyContent: 'center' },
  memoText: { fontFamily: 'previewMemo', fontSize: 48, color: '#181818', textAlign: 'center', includeFontPadding: false },
  input: { padding: 0, width: '100%' }, read: { flex: 1, marginBottom: 48 }, readContents: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  actions: { position: 'absolute', left: 20, right: 20, bottom: 20, flexDirection: 'row', justifyContent: 'space-between' },
  actionText: { fontFamily: RollpeFonts.display, fontSize: 20, color: '#181818' }, danger: { color: '#EF3C3C' },
  editedText: { fontFamily: RollpeFonts.display, fontSize: 16, color: '#181818' }, historyLink: { textDecorationLine: 'underline' },
  palette: { marginTop: 40, height: 40, maxWidth: '100%', paddingHorizontal: 20 },
  swatches: { gap: 12, alignItems: 'center' }, swatch: { width: 40, height: 40, borderRadius: 20 },
  whiteText: { fontFamily: RollpeFonts.display, fontSize: 16, color: '#FFFFFF', textAlign: 'center' },
});
