import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { bookingNeedsDateReview, tripDate, type TripBooking } from '@/lib/saved-trips';
import { bookingHeading, bookingDateNote } from '@/lib/trip-presentation';
import { bookingCriteria } from '@/lib/trip-booking-links';
import { bookingDisplay } from '@/lib/trip-booking-display';
import { colors } from '@/lib/theme';
import { AppIcon } from './app-icon';
import { TripAdmissionInfo } from './trip-admission-info';
import { tripViewStyles as s } from './trip-view-styles';

export type BookingCardActions = { busy: boolean; confirmDelete: string; tripStartDate: string; onConfirmDates: (item: TripBooking) => void; onOpen: (item: TripBooking) => void; onOpenAlternative: (item: TripBooking, url: string) => void; onEdit: (item: TripBooking) => void; onCopy: (item: TripBooking) => void; onToggle: (item: TripBooking) => void; onRemove: (item: TripBooking) => void };
export function TripBookingCard({ item, contextual = false, ...actions }: BookingCardActions & { item: TripBooking; contextual?: boolean }) {
  useLanguage();
  const [expanded, setExpanded] = useState(false);
  const { admission, link, freeVisit, paidExtra, buttonLabel, showQuery } = bookingDisplay(item);
  const review = bookingNeedsDateReview({ startDate: actions.tripStartDate }, item);
  const status = item.booked && !freeVisit ? '已完成' : admission?.label ?? link.requirement ?? (freeVisit ? '免费参观' : item.kind === 'attraction' ? '待确认' : '待预订');
  const checkLabel = item.kind === 'attraction' ? '我已确认参观或票务安排' : '我已完成预订';
  const checkbox = <Pressable accessibilityRole="checkbox" accessibilityLabel={`${bookingHeading(item)}：${checkLabel}`} accessibilityState={{ checked: item.booked, disabled: actions.busy }} disabled={actions.busy}
    onPress={() => actions.onToggle(item)} style={[s.row, { minHeight: 44, minWidth: 44 }]}>
    <View style={[s.checkbox, item.booked && s.checked]}>{item.booked && <AppIcon name="check" size={15} color={colors.background} />}</View>
    {contextual && <Text style={[s.note, s.grow]}>{checkLabel}{item.booked ? '（已勾选）' : ''}</Text>}
  </Pressable>;
  function open() {
    if (review) actions.onEdit(item);
    else if (paidExtra) actions.onOpenAlternative(item, paidExtra.url);
    else if (showQuery) actions.onOpen(item);
  }
  return <View style={[s.card, { gap: 8, padding: 14 }]}>
    <View style={[s.row, { gap: 0, alignItems: 'flex-start' }]}>
      {contextual ? <View style={{ width: 32, paddingTop: 3 }}><AppIcon name={item.kind} size={20} /></View> : checkbox}
      <View style={[s.grow, { gap: 3 }]}><Text style={s.label}>{bookingHeading(item)}</Text><Text style={s.note}>Day {item.day} · {bookingDateNote(item)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${bookingHeading(item)}：更多操作`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[s.link, { minWidth: 44, alignItems: 'center', paddingVertical: 0 }]}><AppIcon name={expanded ? 'close' : 'more'} size={19} /></Pressable>
    </View>
    <View style={[s.row, { flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }]}>
      <Text style={[s.note, s.grow]}>{review ? '日期已调整，待核对' : status}{!review && paidExtra ? ' · 缆车另付费' : !review && freeVisit && item.booked ? ' · 已确认' : ''}</Text>
      {(review || paidExtra || showQuery) && <Pressable accessibilityRole="button" accessibilityLabel={`${bookingHeading(item)}：${review ? '核对日期' : buttonLabel}`} disabled={actions.busy} onPress={open} style={({ pressed }) => [s.smallButton, { paddingVertical: 8 }, (pressed || actions.busy) && s.disabled]}><Text style={s.smallButtonText}>{review ? '核对日期' : buttonLabel}</Text></Pressable>}
    </View>
    {expanded && <View style={{ gap: 12 }}>
      <View style={s.divider} />{contextual && checkbox}
      <Text selectable style={s.note}>{bookingCriteria(item)}</Text>
      {!freeVisit && <Text style={s.note}>{link.precision}</Text>}
      {!admission && <Text style={s.note}>{freeVisit ? paidExtra ? link.review : '无需购买入场门票，额外体验或消费另计。' : `${link.review} 完成后手动勾选，不同步网站订单。`}</Text>}
      {admission && <TripAdmissionInfo evidence={admission} initiallyExpanded />}
      {review && <><Text style={s.note}>原日期：{bookingDateNote(item)}。当前 Day {item.day}：{tripDate(actions.tripStartDate, item.day) || '日期未定'}。已有预订不会自动改期。</Text><Pressable accessibilityRole="button" disabled={actions.busy} onPress={() => actions.onConfirmDates(item)} style={s.link}><Text style={s.linkText}>保留原日期，已核对</Text></Pressable></>}
      {link.alternatives.filter(choice => choice.url !== paidExtra?.url).map(choice => <Pressable key={choice.url} accessibilityRole="button" disabled={actions.busy} onPress={() => actions.onOpenAlternative(item, choice.url)} style={s.link}><Text style={s.linkText}>{choice.shortLabel || choice.label}</Text></Pressable>)}
      <View style={s.wrap}>
        <Pressable accessibilityRole="button" disabled={actions.busy} onPress={() => actions.onEdit(item)} style={[s.smallButton, s.secondaryButton]}><Text style={[s.smallButtonText, s.secondaryButtonText]}>编辑</Text></Pressable>
        {!freeVisit && <Pressable accessibilityRole="button" disabled={actions.busy} onPress={() => actions.onCopy(item)} style={[s.smallButton, s.secondaryButton]}><Text style={[s.smallButtonText, s.secondaryButtonText]}>复制条件</Text></Pressable>}
        <Pressable accessibilityRole="button" disabled={actions.busy} onPress={() => actions.onRemove(item)} style={s.link}><Text style={s.linkText}>{actions.confirmDelete === item.id ? '再次点击，确认移除' : '移除'}</Text></Pressable>
      </View>
    </View>}
  </View>;
}
