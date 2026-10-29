import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { OVERLAY_OPACITY, RollpeFonts, useRollpeColors } from '@/constants/theme';
import { WEB_MAX_WIDTH } from '@/components/WebViewport';
import { AppModal } from '@/components/ui/AppModal';
import { AppDialog } from '@/components/ui/AppDialog';

export function AppSideMenu({ current = 'home', onClose }: { current?: 'home' | 'search' | 'myPage'; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState(false);
  const { width } = useWindowDimensions();
  const contentWidth = Platform.OS === 'web' ? Math.min(width, WEB_MAX_WIDTH) : width;
  const menuWidth = contentWidth * 0.8;
  const [offset] = useState(() => new Animated.Value(menuWidth));
  const [opacity] = useState(() => new Animated.Value(0));
  const driver = Platform.OS !== 'web';
  function close(destination?: '/home' | '/search' | '/my-page') {
    if (closing) return;
    setClosing(true);
    Animated.parallel([
      Animated.timing(offset, { toValue: menuWidth, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: driver }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: driver }),
    ]).start(({ finished }) => { if (finished) { onClose(); if (destination) router.replace(destination); } });
  }
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !closing && gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => { if (!closing) offset.setValue(Math.max(0, gesture.dx)); },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > contentWidth * 0.4 || gesture.vx * 1000 > contentWidth * 0.4) close();
      else Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start();
    },
    onPanResponderTerminate: () => Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start(),
  });
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(offset, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: driver }),
      Animated.timing(opacity, { toValue: OVERLAY_OPACITY, duration: 250, useNativeDriver: driver }),
    ]);
    animation.start();
    return () => { animation.stop(); offset.stopAnimation(); opacity.stopAnimation(); };
  }, [offset, opacity, driver]);
  return <AppModal visible animationType="none" onClose={() => { if (notice) setNotice(false); else close(); }} contentStyle={styles.modalContent} backdrop={<>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity }]} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.menuClose')} style={StyleSheet.absoluteFill} onPress={() => close()} />
  </>}>
    <Animated.View {...pan.panHandlers} style={[styles.menu, { width: menuWidth, backgroundColor: colors.rollpe_primary,
      transform: [{ translateX: offset }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.menuClose')} hitSlop={16} style={styles.close} onPress={() => close()}>
        <Image source={require('@/assets/images/home/close.svg')} contentFit="contain" accessible={false} style={styles.closeIcon} />
      </Pressable>
      <View style={styles.contents}>
        {(['home', 'search', 'contact', 'myPage'] as const).map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === current }}
          onPress={() => {
            if (item === current) close();
            else if (item === 'home' || item === 'search') close(item === 'home' ? '/home' : '/search');
            else if (item === 'myPage') close('/my-page');
            else if (item === 'contact') void Linking.openURL('https://forms.gle/WGC7ibNBgTnomRgZ7').catch(() => setNotice(true));
          }}>
          <Text style={[styles.label, { color: item === current ? colors.rollpe_main : colors.rollpe_secondary }]}>{t(item === 'home' ? 'common.home' : `home.${item}`)}</Text>
        </Pressable>)}
      </View>
    </Animated.View>
    {notice && <AppDialog message={t('common.openLinkFailed')} onConfirm={() => setNotice(false)} />}
  </AppModal>;
}

const styles = StyleSheet.create({
  modalContent: { padding: 0 },
  menu: { position: 'absolute', right: 0, top: 0, bottom: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  close: { position: 'absolute', top: 80, right: 28 },
  closeIcon: { width: 12, height: 12 },
  contents: { marginTop: 120, marginHorizontal: 40, gap: 40 },
  label: { fontFamily: RollpeFonts.display, fontSize: 40 },
});
