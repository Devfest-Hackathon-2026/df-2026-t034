import { useLanguage } from '@/components/language-provider';
import { Host, TextField, useNativeState, type TextFieldRef } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, font, foregroundStyle, lineLimit, textFieldStyle, textInputAutocapitalization, tint } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import type { PlannerInputProps } from './planner-input.types';

export function PlannerInput({ ref, reset, editable, onChangeText, onFocus }: PlannerInputProps) {
  const { t } = useLanguage();
  const field = useRef<TextFieldRef>(null);
  const nativeText = useNativeState('');
  useImperativeHandle(ref, () => ({
    // Focus is best-effort if navigation/reload removes the native view.
    focus: () => { void field.current?.focus().catch(() => undefined); },
    blur: () => { void field.current?.blur().catch(() => undefined); },
  }), []);

  // The native field owns typing/composition. Never write each JS keystroke back
  // into UIKit: doing so can erase the IME's marked range and underline.
  useEffect(() => { nativeText.set(reset.value); }, [reset, nativeText]);

  return (
    <View style={styles.input}>
      <Host matchContents={{ vertical: true }} ignoreSafeArea="all" colorScheme="light" style={styles.host} seedColor={colors.action}>
        <TextField
          ref={field} text={nativeText} placeholder={t('说说你想怎样旅行…')}
          axis="vertical" maxLength={MAX_MESSAGE_LENGTH}
          onTextChange={onChangeText} onFocusChange={(focused) => { if (focused) onFocus(); }}
          modifiers={[
            textFieldStyle('plain'), font({ size: 16 }), foregroundStyle(colors.text),
            tint(colors.action), lineLimit({ min: 1, max: 5 }),
            textInputAutocapitalization('never'), disabled(!editable), accessibilityLabel(t('旅行需求')),
          ]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, minHeight: 48, justifyContent: 'center', backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 13 },
  host: { width: '100%' },
});
