import { Image, type ImageProps } from 'expo-image';
import { Children, type ReactNode, type Ref, type ComponentRef } from 'react';
import { Pressable, Text, TextInput, ActivityIndicator, type TextProps, type PressableProps, type TextInputProps, type ActivityIndicatorProps } from 'react-native';
import { useLanguage } from './language-provider';
// Only interface chrome uses this component. User/AI prose, author names and
// original plan data explicitly use raw; their persisted contents never change.
export function UiText({ children, raw = false, ...props }: TextProps & { raw?: boolean }) {
  const { t } = useLanguage();
  function localize(nodes: ReactNode) {
    const parts = Children.toArray(nodes);
    if (parts.every(part => typeof part === 'string' || typeof part === 'number')) { const joined = parts.join(''); const result = t(joined); if (result !== joined) return result; }
    return parts.map(part => typeof part === 'string' ? t(part) : part);
  }
  return <Text {...props} accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}>{raw ? children : localize(children)}</Text>;
}
export function UiPressable({ accessibilityLabel, accessibilityHint, ...props }: PressableProps) {
  const { t } = useLanguage();
  return <Pressable {...props} accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : undefined} accessibilityHint={accessibilityHint ? t(accessibilityHint) : undefined} />;
}
export function UiTextInput({ placeholder, accessibilityLabel, ...props }: TextInputProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const { t } = useLanguage();
  return <TextInput {...props} placeholder={placeholder ? t(placeholder) : undefined} accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : undefined} />;
}
export function UiActivityIndicator({ accessibilityLabel, ...props }: ActivityIndicatorProps) {
  const { t } = useLanguage();
  return <ActivityIndicator {...props} accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : undefined} />;
}

export function UiImage({ accessibilityLabel, ...props }: ImageProps) {
  const { t } = useLanguage();
  return <Image {...props} accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : undefined} />;
}
