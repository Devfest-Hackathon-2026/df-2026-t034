import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { View } from 'react-native';
import type { BookingKind } from '@/lib/saved-trips';
import { bookingLabels } from './trip-booking-editor';
import { tripViewStyles as s } from './trip-view-styles';

export function TripAddPreparation({ busy, onAdd }: { busy: boolean; onAdd: (kind: BookingKind) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={s.link}><Text style={s.linkText}>{expanded ? '收起添加选项' : '添加其他事项'}</Text></Pressable>
    {expanded && <View style={s.wrap}>{(Object.keys(bookingLabels) as BookingKind[]).map(kind => <Pressable key={kind} accessibilityRole="button" disabled={busy} onPress={() => onAdd(kind)} style={[s.smallButton, s.secondaryButton]}><Text style={[s.smallButtonText, s.secondaryButtonText]}>{bookingLabels[kind]}</Text></Pressable>)}</View>}
  </View>;
}
