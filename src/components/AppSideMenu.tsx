import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';

import { useTranslation } from '@/i18n';
import { OVERLAY_OPACITY, RollpeFonts, useRollpeColors } from '@/constants/theme';
import { WEB_MAX_WIDTH } from '@/components/WebViewport';
import { AppModal } from '@/components/ui/AppModal';
import { useAppNavigation } from '@/hooks/useAppNavigation';

export function AppSideMenu({
  current = 'home',
  onClose,
}: {
  current?: 'home' | 'search' | 'myPage';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const { openMainScreen } = useAppNavigation();
  const [closing, setClosing] = useState(false);
  const { width } = useWindowDimensions();
  const contentWidth = Platform.OS === 'web' ? Math.min(width, WEB_MAX_WIDTH) : width;
  const menuWidth = contentWidth * 0.8;
  const [offset] = useState(() => new Animated.Value(menuWidth));
  const [opacity] = useState(() => new Animated.Value(0));
  const driver = Platform.OS !== 'web';
  function close(destination?: 'home' | 'search' | 'my-page' | 'contact') {
    if (closing) return;
    setClosing(true);
    Animated.parallel([
      Animated.timing(offset, {
        toValue: menuWidth,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: driver,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: driver }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        if (destination) openMainScreen(destination);
      }
    });
  }
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      !closing && gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => {
      if (!closing) offset.setValue(Math.max(0, gesture.dx));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > contentWidth * 0.4 || gesture.vx * 1000 > contentWidth * 0.4) close();
      else Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start();
    },
    onPanResponderTerminate: () =>
      Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start(),
  });
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(offset, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: driver,
      }),
      Animated.timing(opacity, {
        toValue: OVERLAY_OPACITY,
        duration: 250,
        useNativeDriver: driver,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      offset.stopAnimation();
      opacity.stopAnimation();
    };
  }, [offset, opacity, driver]);
  return (
    <AppModal
      visible
      animationType="none"
      onClose={() => close()}
      contentStyle={styles.modalContent}
      backdrop={
        <>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.menuClose')}
            style={StyleSheet.absoluteFill}
            onPress={() => close()}
          />
        </>
      }
    >
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.menu,
          {
            width: menuWidth,
            backgroundColor: colors.rollpe_primary,
            transform: [{ translateX: offset }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menuClose')}
          hitSlop={16}
          style={styles.close}
          onPress={() => close()}
        >
          <Image
            source={require('@/assets/images/home/close.svg')}
            contentFit="contain"
            accessible={false}
            style={styles.closeIcon}
          />
        </Pressable>
        <ScrollView
          style={styles.contents}
          contentContainerStyle={styles.items}
          showsVerticalScrollIndicator={false}
        >
          {(['home', 'search', 'contact', 'myPage'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: item === current }}
              onPress={() => {
                if (item === current) close();
                else if (item === 'home' || item === 'search') close(item);
                else if (item === 'myPage') close('my-page');
                else close('contact');
              }}
            >
              <Text
                style={[
                  styles.label,
                  { color: item === current ? colors.rollpe_main : colors.rollpe_secondary },
                ]}
              >
                {t(item === 'home' ? 'common.home' : `home.${item}`)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalContent: { padding: 0 },
  menu: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  close: { position: 'absolute', top: 80, right: 28 },
  closeIcon: { width: 12, height: 12 },
  contents: { flex: 1, marginTop: 120, marginHorizontal: 40 },
  items: { gap: 40, paddingBottom: 40 },
  label: { fontFamily: RollpeFonts.display, fontSize: 40 },
});
