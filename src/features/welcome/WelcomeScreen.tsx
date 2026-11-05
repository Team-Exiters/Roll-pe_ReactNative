import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppFooter } from '@/components/AppFooter';
import { useRollpeColors } from '@/constants/theme';
import { Welcome1stSection } from '@/features/welcome/components/Welcome1stSection';
import { Welcome2ndSection } from '@/features/welcome/components/Welcome2ndSection';
import { Welcome3rdSection } from '@/features/welcome/components/Welcome3rdSection';

export default function WelcomeScreen() {
  const colors = useRollpeColors();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.rollpe_primary }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Welcome1stSection onStart={() => router.navigate('/sign-in')} />
      <Welcome2ndSection />
      <Welcome3rdSection />
      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
