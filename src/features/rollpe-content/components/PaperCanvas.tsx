import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useRotationGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { RollpePaper } from '@/components/rollpe/RollpePaper';
import type { RollpeInfo } from '@/features/rollpe-info/model';

export function PaperCanvas({ paper, disabled, onMemoPress }: { paper: RollpeInfo; disabled: boolean; onMemoPress: (index: number) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const x = useSharedValue(0), y = useSharedValue(0), scale = useSharedValue(1), rotation = useSharedValue(0);
  useEffect(() => { x.set(0); y.set(0); scale.set(1); rotation.set(0); }, [size.width, size.height, x, y, scale, rotation]);
  const pan = usePanGesture({ enabled: !disabled, minDistance: 8, averageTouches: true,
    onUpdate: event => { x.set(value => value + event.changeX); y.set(value => value + event.changeY); } });
  const pinch = usePinchGesture({ enabled: !disabled,
    onUpdate: event => { scale.set(value => Math.min(4, Math.max(0.25, value * event.scaleChange))); } });
  const turn = useRotationGesture({ enabled: !disabled,
    onUpdate: event => { rotation.set(value => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, value + event.rotationChange))); } });
  const gesture = useSimultaneousGestures(pan, pinch, turn);
  const transform = useAnimatedStyle(() => ({ transform: [
    { translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }, { rotateZ: `${rotation.get()}rad` },
  ] }));
  const width = size.height * (paper.ratio === '세로' ? 595 / 842 : 842 / 595);
  return <GestureHandlerRootView style={styles.screen}>
    <GestureDetector gesture={gesture}>
      <View style={styles.screen} onLayout={({ nativeEvent: { layout } }) => setSize({ width: layout.width, height: layout.height })}>
        {width > 0 && <Animated.View style={[styles.paper, { width }, transform]}>
          <RollpePaper {...paper} width={width} messages={paper.hearts.data} onMemoPress={disabled ? undefined : onMemoPress} />
        </Animated.View>}
      </View>
    </GestureDetector>
  </GestureHandlerRootView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, overflow: 'hidden' }, paper: { position: 'absolute', left: 0, top: 0 } });
