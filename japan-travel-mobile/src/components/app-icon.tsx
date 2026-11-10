import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import type { ColorValue } from 'react-native';
import { colors } from '@/lib/theme';
const symbols = {
  discover: { ios: 'safari', android: 'explore', web: 'explore' },
  chat: { ios: 'bubble', android: 'chat_bubble', web: 'chat_bubble' },
  map: { ios: 'map', android: 'map', web: 'map' },
  settings: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  arrow: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  diagonal: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  down: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  chevron: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  close: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  globe: { ios: 'globe', android: 'language', web: 'language' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  flight: { ios: 'airplane', android: 'flight', web: 'flight' },
  hotel: { ios: 'bed.double', android: 'bed', web: 'bed' },
  train: { ios: 'tram', android: 'train', web: 'train' },
  attraction: { ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
} as const;
export function AppIcon({ name, size = 22, color = colors.text }: {
  name: keyof typeof symbols; size?: number; color?: ColorValue;
}) {
  if (name === 'chat') {
    return <Image source={require('../../assets/icons/message-circle.svg')}
      style={{ width: size, height: size }} contentFit="contain"
      tintColor={typeof color === 'string' ? color : colors.text} />;
  }
  return <SymbolView name={symbols[name]} size={size} tintColor={color} weight="regular" />;
}
