import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function AppFooter() {
  const colors = useRollpeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.team_exiters }]}>
      <Image
        accessibilityLabel="Team Exiters"
        accessible
        source={require('@/assets/images/welcome/team-exiters.svg')}
        contentFit="contain"
        style={styles.logo}
      />
      <Text numberOfLines={1} style={[styles.email, { color: colors.rollpe_primary }]}>
        team.exiters@gmail.com
      </Text>
      <Text numberOfLines={1} style={[styles.copyright, { color: colors.rollpe_primary }]}>
        Copyright 2025 Team Exiters. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 32,
  },
  logo: {
    width: 192,
    aspectRatio: 188 / 20,
    marginBottom: 24,
  },
  email: {
    alignSelf: 'stretch',
    fontFamily: RollpeFonts.regular,
    fontSize: 10,
    textAlign: 'center',
  },
  copyright: {
    alignSelf: 'stretch',
    fontFamily: RollpeFonts.regular,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
