import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type User = { id: number; name: string; identifyCode: string };

export function UserList<T extends User>({ users, loading, loadingLabel, emptyMessage, selectedId, onSelect, renderDetail, renderAction }: {
  users: T[]; loading?: boolean; loadingLabel?: string; emptyMessage?: string; selectedId?: number;
  onSelect?: (user: T) => void; renderDetail?: (user: T) => ReactNode; renderAction?: (user: T) => ReactNode;
}) {
  const colors = useRollpeColors();
  return <View style={[styles.results, { borderColor: colors.rollpe_secondary }]}>
    {loading ? <ActivityIndicator style={styles.loading} accessibilityLabel={loadingLabel} color={colors.rollpe_main} />
      : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rows}>
        {!users.length && emptyMessage && <Text style={[styles.empty, { color: colors.rollpe_secondary }]}>{emptyMessage}</Text>}
        {users.map((user, index) => {
          const content = <>
            {selectedId === user.id && <Image source={require('@/assets/images/create-rollpe/check.svg')}
              tintColor={colors.rollpe_main} accessible={false} contentFit="contain" style={styles.check} />}
            <View style={styles.name}>
              <Text style={[styles.userName, { color: colors.rollpe_secondary }]}>{user.name}({user.identifyCode})</Text>
              {renderDetail?.(user)}
            </View>
          </>;
          return <View key={user.id}>
            <View style={styles.user}>
              {onSelect ? <Pressable accessibilityRole="radio" accessibilityLabel={`${user.name}(${user.identifyCode})`}
                accessibilityState={{ checked: selectedId === user.id }} onPress={() => onSelect(user)} style={styles.selectable}>{content}</Pressable>
                : <View style={styles.selectable}>{content}</View>}
              {renderAction?.(user)}
            </View>
            {index < users.length - 1 && <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />}
          </View>;
        })}
      </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  results: { flex: 1, marginTop: 20, borderWidth: 2, borderRadius: 16, overflow: 'hidden' },
  loading: { flex: 1 }, rows: { paddingVertical: 4 },
  user: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { flex: 1 },
  userName: { fontFamily: RollpeFonts.display, fontSize: 20 }, check: { width: 10, height: 10 },
  separator: { height: 2, marginHorizontal: 16, borderRadius: 1 },
  empty: { fontFamily: RollpeFonts.regular, fontSize: 14, padding: 20, textAlign: 'center' },
});
