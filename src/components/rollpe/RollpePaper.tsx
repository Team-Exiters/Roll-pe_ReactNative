import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { choiceLabel, useTranslation } from '@/i18n';

// Original A4 layouts and rotations from the six iOS RollpeV1 theme views.
const horizontal = [
  [16.5, 26, -2.72],
  [187.5, 24, 0],
  [344.5, 24, 5.39],
  [512.5, 21, 0.22],
  [678.5, 13, -1.6],
  [34.5, 217, 2.78],
  [665.5, 210, 3.1],
  [23.5, 403, -1.98],
  [188.5, 408, 4.03],
  [347.5, 393, -1.98],
  [514.5, 408, -0.5],
  [673.5, 398, -2.83],
];
const vertical = [
  [13.41, 204.5, 0.86],
  [158.34, 218.05, -0.26],
  [304.6, 207.98, 0.15],
  [448.17, 219.5, 0.42],
  [9.82, 417.79, 0.07],
  [156.41, 424.5, 0.86],
  [301.12, 420.01, -0.74],
  [449.77, 425.38, 0.76],
  [12.11, 631.15, 1.45],
  [157.24, 626.64, -0.11],
  [304.44, 635.43, 1.23],
  [447.45, 629.23, -0.66],
];
const memoColors = [
  '#F228D3',
  '#F2EB28',
  '#F2EB28',
  '#28E8F2',
  '#F2EB28',
  '#28E8F2',
  '#F228D3',
  '#F2EB28',
  '#28E8F2',
  '#F228D3',
  '#F228D3',
  '#28E8F2',
];
const memorialMemoColors = [
  '#999999',
  '#D3D3D3',
  '#999999',
  '#999999',
  '#999999',
  '#999999',
  '#D3D3D3',
  '#999999',
  '#D3D3D3',
  '#999999',
  '#D3D3D3',
  '#999999',
];
const fonts = {
  previewWhite: require('@/assets/fonts/JalnanGothic.otf'),
  previewCongrats: require('@/assets/fonts/JalnanOTF.otf'),
  previewMemorial: require('@/assets/fonts/NanumMyeongjo.ttf'),
  previewMemo: require('@/assets/fonts/NanumPen.otf'),
};

type PaperMessage = { index: number; content: string; author: { name: string }; color: string };
type RollpePaperProps = {
  title: string;
  ratio: string;
  theme: string;
  size: string;
  sample?: boolean;
  messages?: readonly PaperMessage[];
  width?: number;
  shadow?: boolean;
  paperRef?: Ref<ComponentRef<typeof View>>;
  onReadyChange?: (ready: boolean) => void;
  onMemoPress?: (index: number) => void;
};

export function RollpePaper({
  title,
  ratio,
  theme,
  size,
  sample = false,
  messages = [],
  width: fixedWidth,
  shadow = true,
  paperRef,
  onReadyChange,
  onMemoPress,
}: RollpePaperProps) {
  const { t } = useTranslation();
  const [measuredWidth, setWidth] = useState(0);
  const width = fixedWidth ?? measuredWidth;
  const [loadedImage, setLoadedImage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [loaded, fontError] = useFonts(fonts);
  const ready =
    loaded && width > 0 && !imageFailed && (theme === '화이트' || loadedImage === theme);
  useEffect(() => {
    onReadyChange?.(Boolean(ready));
  }, [ready, onReadyChange]);
  if (
    size !== 'A4' ||
    !['가로', '세로'].includes(ratio) ||
    !['화이트', '추모', '축하'].includes(theme)
  )
    return null;
  const isVertical = ratio === '세로';
  const memorial = theme === '추모';
  const congrats = theme === '축하';
  const paperWidth = isVertical ? 595 : 842;
  const paperHeight = isVertical ? 842 : 595;
  const scale = width / paperWidth;
  // RN converts boxShadow blur to CALayer.shadowRadius by dividing it by two.
  const dropShadow = `0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.25)`;
  const titleWidth = memorial ? (isVertical ? 381 : 396) : isVertical ? 400 : 416;
  const backgroundColor = memorial ? '#393939' : congrats ? '#FFC0F4' : '#FFFFFF';
  const Memo = onMemoPress ? Pressable : View;
  return (
    <View
      style={fixedWidth ? { width: fixedWidth } : styles.frame}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <View
          ref={paperRef}
          collapsable={false}
          accessible={onMemoPress ? false : undefined}
          accessibilityRole={onMemoPress ? undefined : 'image'}
          accessibilityLabel={t('create.previewDescription', {
            ratio: choiceLabel(ratio),
            theme: choiceLabel(theme),
            size,
            title: title || t('create.enterTitle'),
          })}
          style={{
            width,
            height: paperHeight * scale,
            backgroundColor,
            boxShadow: shadow ? dropShadow : undefined,
          }}
        >
          {congrats && (
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
              <Image
                source={require('@/assets/images/create-rollpe/confetti.png')}
                accessible={false}
                contentFit="cover"
                loading="eager"
                onLoad={() => setLoadedImage(theme)}
                onError={() => setImageFailed(true)}
                style={{ width, height: width, opacity: 0.5 }}
              />
            </View>
          )}
          {memorial && (
            <Image
              source={require('@/assets/images/create-rollpe/chrysanthemum.png')}
              accessible={false}
              contentFit="cover"
              loading="eager"
              onLoad={() => setLoadedImage(theme)}
              onError={() => setImageFailed(true)}
              style={{
                position: 'absolute',
                width: (isVertical ? 307 : 329) * scale,
                height: (isVertical ? 125 : 135) * scale,
                left: ((paperWidth - (isVertical ? 307 : 329)) * scale) / 2,
                top: (isVertical ? 44 : (paperHeight - 135) / 2) * scale,
                opacity: 0.5,
              }}
            />
          )}
          {loaded && !imageFailed ? (
            <>
              {(isVertical ? vertical : horizontal).map(([x, y, rotation], index) => {
                const radians = (rotation * Math.PI) / 180;
                const rotatedWidth =
                  140 * Math.abs(Math.cos(radians)) + 160 * Math.abs(Math.sin(radians));
                const rotatedHeight =
                  140 * Math.abs(Math.sin(radians)) + 160 * Math.abs(Math.cos(radians));
                const message = messages.find((value) => value.index === index);
                return (
                  <Memo
                    key={index}
                    accessible={Boolean(onMemoPress)}
                    accessibilityRole={onMemoPress ? 'button' : undefined}
                    accessibilityLabel={
                      onMemoPress
                        ? t(message ? 'heart.writtenSlot' : 'heart.emptySlot', {
                            index: index + 1,
                            name: message?.author.name ?? '',
                          })
                        : undefined
                    }
                    onPress={onMemoPress ? () => onMemoPress(index) : undefined}
                    style={{
                      position: 'absolute',
                      left: (x + (rotatedWidth - 140) / 2) * scale,
                      top: (y + (rotatedHeight - 160) / 2) * scale,
                      width: 140 * scale,
                      height: 160 * scale,
                      padding: 8 * scale,
                      justifyContent: 'center',
                      backgroundColor: sample
                        ? (memorial ? memorialMemoColors : memoColors)[index]
                        : (message?.color ?? 'rgba(170,170,170,0.5)'),
                      borderWidth: !sample && !message ? scale : 0,
                      borderStyle: 'dashed',
                      borderColor: '#181818',
                      overflow: 'hidden',
                      transform: [{ rotate: `${rotation}deg` }],
                      boxShadow: dropShadow,
                    }}
                  >
                    <Text
                      style={{
                        maxHeight: '100%',
                        fontFamily: 'previewMemo',
                        fontSize: 18 * scale,
                        color: '#181818',
                        textAlign: 'center',
                        includeFontPadding: false,
                      }}
                    >
                      {sample
                        ? t('create.previewSample', { count: index + 1 })
                        : message
                          ? `${message.content}\n- ${message.author.name}`
                          : ''}
                    </Text>
                  </Memo>
                );
              })}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: titleWidth * scale,
                  left: ((paperWidth - titleWidth) * scale) / 2,
                  top: isVertical ? 60 * scale : 0,
                  height: isVertical ? undefined : paperHeight * scale,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: memorial
                      ? 'previewMemorial'
                      : congrats
                        ? 'previewCongrats'
                        : 'previewWhite',
                    fontSize: (isVertical ? 40 : 52) * scale,
                    lineHeight: memorial ? undefined : (isVertical ? 52 : 64) * scale,
                    color: memorial || congrats ? '#FFFFFF' : '#181818',
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                >
                  {title || t('create.enterTitle')}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.loading}>
              {fontError || imageFailed ? (
                <Text>{t(imageFailed ? 'info.previewFailed' : 'create.fontFailed')}</Text>
              ) : (
                <ActivityIndicator accessibilityLabel={t('create.previewLoading')} />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
