import { UiTextInput as TextInput } from '@/components/ui';
import { type ComponentRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import type { PlannerInputProps } from './planner-input.types';

export function PlannerInput({ ref, value, editable, onChangeText, onFocus }: PlannerInputProps) {
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  useImperativeHandle(ref, () => ({
    focus: () => field.current?.focus(),
    blur: () => field.current?.blur(),
  }), []);
  return (
    <TextInput
      ref={field}
      accessibilityLabel="旅行需求" placeholder="说说你想怎样旅行…"
      placeholderTextColor={colors.secondary} value={value} onChangeText={onChangeText}
      onFocus={onFocus} editable={editable} multiline maxLength={MAX_MESSAGE_LENGTH}
      textAlignVertical="top" selectionColor={colors.action} style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, minHeight: 48, maxHeight: 140, backgroundColor: colors.surface, paddingHorizontal: 8, paddingTop: 13, paddingBottom: 13, color: colors.text, fontSize: 16, lineHeight: 23 },
});
