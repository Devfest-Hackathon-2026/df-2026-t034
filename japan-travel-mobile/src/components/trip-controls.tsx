import { UiPressable as Pressable, UiText as Text, UiTextInput as TextInput } from '@/components/ui';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

export function TripButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [tripStyles.button, secondary && tripStyles.secondaryButton, disabled && tripStyles.disabledButton, pressed && !disabled && { opacity: 0.65 }]}>
    <Text style={[tripStyles.buttonText, secondary && { color: colors.text }, disabled && { color: secondary ? colors.disabledText : colors.onAction }]}>{label}</Text>
  </Pressable>;
}
export function TripField({ label, value, onChangeText, placeholder, numeric = false, maxLength = 100 }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; numeric?: boolean; maxLength?: number }) {
  return <View style={{ gap: 6 }}><Text style={tripStyles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.secondary}
      keyboardType={numeric ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false} maxLength={maxLength} style={tripStyles.input} />
  </View>;
}
export function TripSheet({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView accessibilityViewIsModal behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[tripStyles.screen, { paddingTop: insets.top }]}>
      <View style={tripStyles.toolbar}><Text accessibilityRole="header" style={[tripStyles.section, { flex: 1 }]}>{title}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={tripStyles.close}><Text style={tripStyles.body}>关闭</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[tripStyles.content, { paddingBottom: insets.bottom + 32 }]}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
export const tripStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { minHeight: 52, padding: 10, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 26, lineHeight: 37, fontWeight: '600' }, section: { color: colors.text, fontSize: 19, lineHeight: 29, fontWeight: '600' },
  body: { color: colors.text, fontSize: 15, lineHeight: 26 }, note: { color: colors.secondary, fontSize: 13, lineHeight: 22 },
  label: { color: colors.text, fontSize: 14, lineHeight: 23, fontWeight: '500' }, input: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, minHeight: 50, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.card, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { backgroundColor: colors.action, minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  secondaryButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, buttonText: { color: colors.onAction, fontSize: 14, lineHeight: 23, fontWeight: '500', textAlign: 'center' },
  error: { color: colors.error, fontSize: 14, lineHeight: 24 }, line: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16, gap: 8 },
});
