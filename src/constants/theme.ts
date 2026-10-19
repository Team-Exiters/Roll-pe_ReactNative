import { useColorScheme } from 'react-native';

export function useRollpeColors() {
  const isDark = useColorScheme() === 'dark';

  // The original iOS color names and values are identical in both modes.
  return {
    rollpe_primary: isDark ? '#FFFFFF' : '#FFFFFF',
    rollpe_secondary: isDark ? '#181818' : '#181818',
    rollpe_main: isDark ? '#FF5656' : '#FF5656',
    rollpe_gray: isDark ? '#AAAAAA' : '#AAAAAA',
    rollpe_section_background: isDark ? '#F4F4F4' : '#F4F4F4',
    team_exiters: isDark ? '#555555' : '#555555',
  };
}

export const RollpeFonts = {
  display: 'HakgyoansimDunggeunmisoOTF-R',
  regular: 'Pretendard-Regular',
  semibold: 'Pretendard-SemiBold',
} as const;
