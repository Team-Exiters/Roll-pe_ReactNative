import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { choiceLabel, useTranslation } from '@/i18n';

// Original A4 layouts and rotations from the six iOS RollpeV1 theme views.
const horizontal = [
  [16.5, 26, -2.72], [187.5, 24, 0], [344.5, 24, 5.39], [512.5, 21, 0.22],
  [678.5, 13, -1.6], [34.5, 217, 2.78], [665.5, 210, 3.1], [23.5, 403, -1.98],
  [188.5, 408, 4.03], [347.5, 393, -1.98], [514.5, 408, -0.5], [673.5, 398, -2.83],
];
const vertical = [
  [13.41, 204.5, 0.86], [158.34, 218.05, -0.26], [304.6, 207.98, 0.15], [448.17, 219.5, 0.42],
  [9.82, 417.79, 0.07], [156.41, 424.5, 0.86], [301.12, 420.01, -0.74], [449.77, 425.38, 0.76],
  [12.11, 631.15, 1.45], [157.24, 626.64, -0.11], [304.44, 635.43, 1.23], [447.45, 629.23, -0.66],
];
const memoColors = ['#F228D3', '#F2EB28', '#F2EB28', '#28E8F2', '#F2EB28', '#28E8F2',
  '#F228D3', '#F2EB28', '#28E8F2', '#F228D3', '#F228D3', '#28E8F2'];
const memorialMemoColors = ['#999999', '#D3D3D3', '#999999', '#999999', '#999999', '#999999',
  '#D3D3D3', '#999999', '#D3D3D3', '#999999', '#D3D3D3', '#999999'];
const fonts = {
  previewWhite: require('@/assets/fonts/JalnanGothic.otf'),
  previewCongrats: require('@/assets/fonts/JalnanOTF.otf'),
  previewMemorial: require('@/assets/fonts/NanumMyeongjo.ttf'),
  previewMemo: require('@/assets/fonts/NanumPen.otf'),
};

export function RollpePreview({ title, ratio, theme, size }: { title: string; ratio: string; theme: string; size: string }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [loaded, fontError] = useFonts(fonts);
  if (size !== 'A4' || !['가로', '세로'].includes(ratio) || !['화이트', '추모', '축하'].includes(theme)) return null;
  const isVertical = ratio === '세로';
  const memorial = theme === '추모';
  const congrats = theme === '축하';
  const paperWidth = isVertical ? 595 : 842;
  const paperHeight = isVertical ? 842 : 595;
  const scale = width / paperWidth;
  const titleWidth = memorial ? (isVertical ? 381 : 396) : (isVertical ? 400 : 416);
  const backgroundColor = memorial ? '#393939' : congrats ? '#FFC0F4' : '#FFFFFF';
  return <View style={styles.frame} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <View accessibilityRole="image" accessibilityLabel={t('create.previewDescription', {
      ratio: choiceLabel(ratio), theme: choiceLabel(theme), size, title: title || t('create.enterTitle'),
    })}
      style={{ width, height: paperHeight * scale, backgroundColor,
        boxShadow: `0 ${4 * scale}px ${4 * scale}px rgba(0,0,0,0.25)` }}>
      {congrats && <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <Image source={require('@/assets/images/create-rollpe/confetti.png')} accessible={false} contentFit="cover"
          style={{ width, height: width, opacity: 0.5 }} />
      </View>}
      {memorial && <Image source={require('@/assets/images/create-rollpe/chrysanthemum.png')} accessible={false} contentFit="cover"
        style={{ position: 'absolute', width: (isVertical ? 307 : 329) * scale, height: (isVertical ? 125 : 135) * scale,
          left: (paperWidth - (isVertical ? 307 : 329)) * scale / 2,
          top: (isVertical ? 44 : (paperHeight - 135) / 2) * scale, opacity: 0.5 }} />}
      {loaded ? <>
        {(isVertical ? vertical : horizontal).map(([x, y, rotation], index) => {
          const radians = rotation * Math.PI / 180;
          const rotatedWidth = 140 * Math.abs(Math.cos(radians)) + 160 * Math.abs(Math.sin(radians));
          const rotatedHeight = 140 * Math.abs(Math.sin(radians)) + 160 * Math.abs(Math.cos(radians));
          return <View key={index} accessible={false} style={{ position: 'absolute',
            left: (x + (rotatedWidth - 140) / 2) * scale, top: (y + (rotatedHeight - 160) / 2) * scale,
            width: 140 * scale, height: 160 * scale, padding: 8 * scale, justifyContent: 'center',
            backgroundColor: (memorial ? memorialMemoColors : memoColors)[index], transform: [{ rotate: `${rotation}deg` }],
            boxShadow: `0 ${4 * scale}px ${4 * scale}px rgba(0,0,0,0.25)` }}>
            <Text style={{ fontFamily: 'previewMemo', fontSize: 18 * scale, color: '#181818', textAlign: 'center', includeFontPadding: false }}>
              {t('create.previewSample', { count: index + 1 })}
            </Text>
          </View>;
        })}
        <View style={{ position: 'absolute', width: titleWidth * scale, left: (paperWidth - titleWidth) * scale / 2,
          top: isVertical ? 60 * scale : 0, height: isVertical ? undefined : paperHeight * scale, justifyContent: 'center' }}>
          <Text style={{ fontFamily: memorial ? 'previewMemorial' : congrats ? 'previewCongrats' : 'previewWhite',
            fontSize: (isVertical ? 40 : 52) * scale, lineHeight: memorial ? undefined : (isVertical ? 52 : 64) * scale,
            color: memorial || congrats ? '#FFFFFF' : '#181818', textAlign: 'center', includeFontPadding: false }}>
            {title || t('create.enterTitle')}
          </Text>
        </View>
      </> : <View style={styles.loading}>
        {fontError ? <Text>{t('create.fontFailed')}</Text> : <ActivityIndicator accessibilityLabel={t('create.previewLoading')} />}
      </View>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: 20, marginTop: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
