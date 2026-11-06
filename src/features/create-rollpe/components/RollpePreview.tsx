import { View } from 'react-native';

import { RollpePaper } from '@/components/rollpe/RollpePaper';

export function RollpePreview(props: {
  title: string;
  ratio: string;
  theme: string;
  size: string;
}) {
  return (
    <View style={{ marginHorizontal: 20, marginTop: 20 }}>
      <RollpePaper {...props} sample />
    </View>
  );
}
