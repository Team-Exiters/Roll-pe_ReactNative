import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { WEB_MAX_WIDTH } from '@/components/WebViewport';
import { OVERLAY_COLOR } from '@/constants/theme';

type AppModalProps = Omit<ModalProps, 'children' | 'transparent' | 'visible' | 'onRequestClose'> & {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  avoidKeyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  backdrop?: ReactNode;
};

export function AppModal({
  children,
  visible,
  onClose,
  avoidKeyboard = false,
  contentStyle,
  backdrop,
  animationType = 'fade',
  ...props
}: AppModalProps) {
  const content = (
    <>
      {backdrop === undefined ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop]} />
      ) : (
        backdrop
      )}
      <View
        pointerEvents="box-none"
        style={[styles.content, Platform.OS === 'web' && styles.webContent, contentStyle]}
      >
        {children}
      </View>
    </>
  );

  return (
    <Modal
      {...props}
      transparent
      visible={visible}
      animationType={animationType}
      onRequestClose={onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          accessibilityViewIsModal
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View accessibilityViewIsModal style={styles.screen}>
          {content}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backdrop: { backgroundColor: OVERLAY_COLOR },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  webContent: { width: '100%', maxWidth: WEB_MAX_WIDTH, alignSelf: 'center' },
});
