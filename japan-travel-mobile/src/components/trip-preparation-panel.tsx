import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { View } from 'react-native';
import type { SavedTrip } from '@/lib/saved-trips';
import { tripPreparation, type PreparationSuggestion } from '@/lib/trip-preparation';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
import { tripViewStyles as s } from './trip-view-styles';

export type PreparationActions = { busy: boolean; onReview: (suggestion: PreparationSuggestion) => void; onAccept: (ids: string[]) => void; onSettings: () => void };
export function TripPreparationPanel({ trip, actions, day, compact = false }: { trip: SavedTrip; actions: PreparationActions; day?: number; compact?: boolean }) {
  useLanguage();
  const [expanded, setExpanded] = useState(false), [details, setDetails] = useState(false);
  const preparation = tripPreparation(trip);
  const items = preparation.suggestions.filter(item => day === undefined || item.draft.day === day);
  const visible = items;
  const needsInfo = items.some(item => Boolean(item.problem));
  if (!items.length && !preparation.questions.length) return null;
  if (compact && !expanded) return <Pressable accessibilityRole="button" accessibilityLabel="展开准备建议" accessibilityState={{ expanded: false }} onPress={() => setExpanded(true)} style={s.shortcut}>
    <View style={s.grow}><Text style={s.label}>建议准备{items.length ? ` · ${items.length}项` : ''}</Text>
      {!!preparation.questions.length && <Text style={s.note}>还有{preparation.questions.length}项信息待确认</Text>}
    </View><Text style={s.linkText}>展开</Text><AppIcon name="chevron" size={16} color={colors.secondary} />
  </Pressable>;
  return <View style={{ gap: 10 }}>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={[s.label, s.grow]}>建议准备{items.length ? ` · ${items.length}项` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel="展开准备建议说明" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={s.link}><Text style={s.note}>{details ? '收起说明' : '查看说明'}</Text></Pressable>
      {compact && <Pressable accessibilityRole="button" accessibilityLabel="收起准备建议" accessibilityState={{ expanded: true }} onPress={() => setExpanded(false)} style={s.link}><Text style={s.linkText}>收起</Text></Pressable>}
    </View>
    {!!preparation.questions.length && <View style={[s.row, { gap: 8 }]}><Text style={[s.note, s.grow]}>还有{preparation.questions.length}项信息待确认</Text><Pressable accessibilityRole="button" disabled={actions.busy} onPress={() => { setDetails(true); actions.onSettings(); }} style={s.link}><Text style={s.linkText}>补充信息</Text></Pressable></View>}
    {details && <View style={{ gap: 6 }}><Text style={s.note}>按路线整理，确认后才加入清单，尚未预订。</Text>{preparation.questions.map(question => <Text key={question} style={s.note}>{question}</Text>)}</View>}
    {!!visible.length && <View style={[s.card, { gap: 0, paddingVertical: 2 }]}>{visible.map((item, index) => <View key={item.id} style={{ gap: 6, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}>
      <View style={[s.row, { gap: 10, alignItems: 'center' }]}>
        <AppIcon name={item.draft.kind} size={20} />
        <View style={[s.grow, { gap: 3 }]}><Text style={s.label}>{item.title}</Text><Text style={s.note}>Day {item.draft.day} · {item.draft.date || '日期待定'}{item.draft.endDate ? `—${item.draft.endDate.slice(5)}` : ''}{item.draft.people ? ` · ${item.draft.people}人` : ' · 人数待定'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`核对${item.title}`} disabled={actions.busy} onPress={() => actions.onReview(item)} style={[s.link, { minWidth: 44, alignItems: 'center' }]}><Text style={s.linkText}>{item.problem ? '补充' : '核对'}</Text></Pressable>
      </View>
      {details && <><Text style={s.note}>{item.reason}</Text>{!!item.problem && <Text style={s.note}>{item.problem}</Text>}</>}
    </View>)}</View>}
    {items.length > 0 && <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" disabled={actions.busy || needsInfo} onPress={() => actions.onAccept(items.map(item => item.id))} style={[s.smallButton, (actions.busy || needsInfo) && s.disabled]}><Text style={s.smallButtonText}>确认加入{items.length}项准备</Text></Pressable>
      {needsInfo && <Text style={s.note}>请先补充日期、人数或地点。</Text>}
    </View>}
  </View>;
}
