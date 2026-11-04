import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export default function RollpeUnavailableScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/welcome/logo.png')}
          contentFit="contain"
          accessibilityLabel={t('common.brand')}
          style={styles.logo}
        />
        <Text
          accessibilityRole="alert"
          style={[styles.description, { color: colors.rollpe_secondary }]}
        >
          {t('info.unavailable')}
        </Text>
        <PrimaryButton
          title={t('info.goBack')}
          onPress={() => {
            if (router.canDismiss()) router.dismissAll();
            router.replace('/home');
          }}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  content: { width: '100%' },
  logo: { width: 104, height: 52, alignSelf: 'center' },
  description: {
    marginTop: 20,
    marginBottom: 40,
    fontFamily: RollpeFonts.display,
    fontSize: 16,
    textAlign: 'center',
  },
});
