import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import type { RollpeChoice } from '@/features/create-rollpe/validation';

export function OptionPicker({ choices, selected, disabled, onSelect }: {
  choices: RollpeChoice[]; selected: RollpeChoice | null; disabled: boolean; onSelect: (choice: RollpeChoice) => void;
}) {
  const colors = useRollpeColors();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {choices.map(choice => {
      const active = choice.id === selected?.id;
      const color = active ? colors.rollpe_secondary : colors.rollpe_gray;
      const theme = choice.type === 'THEME';
      const ratio = choice.type === 'RATIO';
      return <Pressable key={choice.id} accessibilityRole="radio" accessibilityLabel={choice.name}
        accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onSelect(choice)}
        style={[
          theme ? styles.theme : ratio ? styles.ratio : styles.size,
          { opacity: active ? 1 : 0.5 }, !theme && { borderColor: color },
        ]}>
        {ratio ? <Image accessible={false} contentFit="contain" style={styles.paperIcon}
          source={choice.name === '가로' ? require('@/assets/images/create-rollpe/paper-horizontal.png')
            : choice.name === '세로' ? require('@/assets/images/create-rollpe/paper-vertical.png') : undefined} />
          : theme ? <View style={[styles.swatch, {
            backgroundColor: choice.name === '추모' ? '#393939' : choice.name === '축하' ? '#FFC0F4' : colors.rollpe_white,
            borderWidth: choice.name === '화이트' ? 2 : 0, borderColor: colors.rollpe_secondary,
          }]}>
            {choice.name === '축하' && <Image source={require('@/assets/images/home/birthday-cake.svg')}
              accessible={false} contentFit="contain" style={styles.cake} />}
          </View> : null}
        <Text numberOfLines={1} style={[styles.label, ratio && styles.ratioLabel,
          { color, fontSize: choice.type === 'SIZE' ? 24 : 16 }]}>{choice.name}</Text>
        {choice.type === 'SIZE' && <Text style={[styles.maximum, { color }]}>최대 {choice.query.max}명</Text>}
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 20 },
  ratio: { width: 120, height: 140, borderRadius: 16, borderWidth: 2, alignItems: 'center', paddingTop: 12 },
  paperIcon: { width: 80, height: 80 },
  ratioLabel: { position: 'absolute', bottom: 12, left: 16, right: 16 },
  theme: { width: 80, alignItems: 'center', gap: 16 },
  swatch: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cake: { width: 46, height: 46 },
  size: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: RollpeFonts.display, textAlign: 'center' },
  maximum: { fontFamily: RollpeFonts.display, fontSize: 10 },
});
