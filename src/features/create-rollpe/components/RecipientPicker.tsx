import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { searchRecipients } from '@/features/create-rollpe/api';
import type { Recipient } from '@/features/create-rollpe/validation';
import { AppModal } from '@/components/ui/AppModal';

export function RecipientPicker({ onSelect, onClose, onError }: {
  onSelect: (user: Recipient) => void; onClose: () => void; onError: (error: unknown) => void;
}) {
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

  return <AppModal visible onClose={onClose} avoidKeyboard>
    <View accessibilityViewIsModal style={[styles.content, { height: height * 0.62, backgroundColor: colors.rollpe_primary }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('create.closeRecipients')} hitSlop={12} onPress={onClose} style={styles.close}>
        <Image source={require('@/assets/images/home/close.svg')} accessible={false} contentFit="contain" style={StyleSheet.absoluteFill} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('create.send')}</Text>
      <View style={styles.search}>
        <RoundedBorderTextField accessibilityLabel={t('create.recipientSearch')} placeholder={t('create.searchPlaceholder')} value={keyword}
          onChangeText={setKeyword} returnKeyType="search" onSubmitEditing={() => { void search(); }} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('create.searchUsers')} onPress={() => { void search(); }} hitSlop={12} style={styles.searchButton}>
          <Image source={require('@/assets/images/create-rollpe/search.svg')} tintColor={colors.rollpe_secondary}
            contentFit="contain" accessible={false} style={styles.searchIcon} />
        </Pressable>
      </View>
      <View style={[styles.results, { borderColor: colors.rollpe_secondary }]}>
        {loading ? <ActivityIndicator style={styles.loading} accessibilityLabel={t('create.searchingUsers')} color={colors.rollpe_main} />
          : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rows}>
            {users.map((user, index) => <View key={user.id}>
              <Pressable accessibilityRole="radio" accessibilityLabel={`${user.name}(${user.identifyCode})`}
                accessibilityState={{ checked: selected?.id === user.id }} onPress={() => setSelected(user)} style={styles.user}>
                {selected?.id === user.id && <Image source={require('@/assets/images/create-rollpe/check.svg')}
                  tintColor={colors.rollpe_main} accessible={false} contentFit="contain" style={styles.check} />}
                <Text style={[styles.userName, { color: colors.rollpe_secondary }]}>{user.name}({user.identifyCode})</Text>
              </Pressable>
              {index < users.length - 1 && <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />}
            </View>)}
          </ScrollView>}
      </View>
      <PrimaryButton title={t('create.select')} style={styles.select} disabled={loading} onPress={() => {
        if (selected) onSelect(selected);
        else onError(new Error(t('create.selectUser')));
      }} />
    </View>
  </AppModal>;
}

const styles = StyleSheet.create({
  content: { borderRadius: 16, paddingHorizontal: 20, paddingBottom: 20 },
  close: { position: 'absolute', top: 28, left: 20, width: 20, height: 20, zIndex: 1 },
  title: { marginTop: 24, fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  search: { marginTop: 28 }, input: { paddingRight: 54 },
  searchButton: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  searchIcon: { width: 22, height: 22 },
  results: { flex: 1, marginTop: 20, borderWidth: 2, borderRadius: 16, overflow: 'hidden' },
  loading: { flex: 1 }, rows: { paddingVertical: 4 },
  user: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { flexShrink: 1, fontFamily: RollpeFonts.display, fontSize: 20 },
  check: { width: 10, height: 10 }, separator: { height: 2, marginHorizontal: 16, borderRadius: 1 },
  select: { marginTop: 28 },
});
