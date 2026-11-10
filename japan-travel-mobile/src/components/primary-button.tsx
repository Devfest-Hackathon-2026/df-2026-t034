import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 50, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.onAction, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
});
