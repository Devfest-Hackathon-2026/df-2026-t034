import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardProvider, useGenericKeyboardHandler, type NativeEvent } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

type Props = PropsWithChildren<{ composer: ReactNode }>;

export function PlannerKeyboardView(props: Props) {
  return <KeyboardProvider preload={false}><PlannerKeyboardFrame {...props} /></KeyboardProvider>;
}

function PlannerKeyboardFrame({ children, composer }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardHeight = useSharedValue(0);
  function trackKeyboard(event: NativeEvent) {
    'worklet';
    keyboardHeight.value = event.height;
  }
  useGenericKeyboardHandler({ onMove: trackKeyboard, onInteractive: trackKeyboard, onEnd: trackKeyboard }, []);
  const listInset = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, keyboardHeight.value - tabBarHeight) }));
  // Move the whole composer from the same native keyboard frames as the inset.
  // Its transform is independent of chat layout or text updates on the JS thread.
  const composerPosition = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboardHeight.value - tabBarHeight) }],
  }));
  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.screen, listInset]}>{children}</Animated.View>
      <Animated.View style={composerPosition}>{composer}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
