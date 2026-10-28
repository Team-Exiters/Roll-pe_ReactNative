import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { searchRecipients } from '@/features/create-rollpe/api';
import type { Recipient } from '@/features/create-rollpe/validation';
import { AppModal } from '@/components/ui/AppModal';
import { UserList } from '@/components/ui/UserList';
import { LoadingView } from '@/components/ui/LoadingView';

type RecipientPickerProps = {
  onSelect: (user: Recipient) => void; onClose: () => void; onError: (error: unknown) => void;
  title?: string; actionTitle?: string; closeLabel?: string; searchLabel?: string;
  busy?: boolean;
  renderActions?: (selected: Recipient | null, searching: boolean) => ReactNode;
};

export function RecipientPicker(props: RecipientPickerProps) {
  return <AppModal visible onClose={props.onClose} avoidKeyboard><RecipientPickerContent {...props} /></AppModal>;
}

export function RecipientPickerContent({ onSelect, onClose, onError, title, actionTitle, closeLabel, searchLabel,
  busy = false, renderActions }: RecipientPickerProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const { height } = useWindowDimensions();
  const [keyword, setKeyword] = useState('');
  const [users, setUsers] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function search() {
    if (busy) return;
    if (!keyword.trim()) { onError(new Error(t('create.enterName'))); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setSelected(null);
    setUsers([]);
    try {
      const results = await searchRecipients(keyword, controller.signal);
      if (controller.signal.aborted) return;
      setUsers(results);
      if (!results.length) onError(new Error(t('create.noResults')));
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <View accessibilityViewIsModal style={[styles.content, { height: height * 0.62, backgroundColor: colors.rollpe_primary }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? t('create.closeRecipients')} disabled={busy} hitSlop={12} onPress={onClose} style={styles.close}>
        <Image source={require('@/assets/images/home/close.svg')} tintColor={colors.rollpe_secondary} accessible={false} contentFit="contain" style={StyleSheet.absoluteFill} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{title ?? t('create.send')}</Text>
      <View style={styles.search}>
        <RoundedBorderTextField accessibilityLabel={searchLabel ?? t('create.recipientSearch')} placeholder={t('create.searchPlaceholder')} value={keyword}
          editable={!busy} onChangeText={value => {
            request.current?.abort();
            setKeyword(value); setSelected(null); setUsers([]); setLoading(false);
          }} returnKeyType="search" onSubmitEditing={() => { void search(); }} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('create.searchUsers')} disabled={busy} onPress={() => { void search(); }} hitSlop={12} style={styles.searchButton}>
          <Image source={require('@/assets/images/create-rollpe/search.svg')} tintColor={colors.rollpe_secondary}
            contentFit="contain" accessible={false} style={styles.searchIcon} />
        </Pressable>
      </View>
      <UserList users={users} loading={loading} loadingLabel={t('create.searchingUsers')} selectedId={selected?.id} onSelect={busy ? undefined : setSelected} />
      <View style={styles.select}>{renderActions ? renderActions(selected, loading)
        : <PrimaryButton title={actionTitle ?? t('create.select')} textStyle={styles.label} disabled={loading || busy} onPress={() => {
          if (selected) onSelect(selected);
          else onError(new Error(t('create.selectUser')));
        }} />}</View>
      {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
    </View>;
}

const styles = StyleSheet.create({
  content: { borderRadius: 16, paddingHorizontal: 20, paddingBottom: 20 },
  close: { position: 'absolute', top: 28, left: 20, width: 20, height: 20, zIndex: 1 },
  title: { marginTop: 24, fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  search: { marginTop: 28 }, input: { paddingRight: 54 },
  searchButton: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  searchIcon: { width: 22, height: 22 },
  select: { marginTop: 28 },
  label: { fontFamily: RollpeFonts.display },
});
