import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

export function PlannerKeyboardView({ children, composer }: PropsWithChildren<{ composer: ReactNode }>) {
  return <KeyboardAvoidingView behavior="height" style={styles.screen}>{children}{composer}</KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
