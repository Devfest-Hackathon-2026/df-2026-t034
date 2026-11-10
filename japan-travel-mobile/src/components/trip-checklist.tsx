import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { dateReviewCount, type BookingKind, type SavedTrip, type TripPlan } from '@/lib/saved-trips';
import { checklistCounts } from '@/lib/trip-presentation';
import { bookingGroups } from '@/lib/trip-booking-display';
import { TripBookingCard, type BookingCardActions } from './trip-booking-card';
import { TripPreparationPanel, type PreparationActions } from './trip-preparation-panel';
import { TripAddPreparation } from './trip-add-preparation';
import { AppIcon } from './app-icon';
import { tripViewStyles as s } from './trip-view-styles';

export function TripChecklist({ trip, plan, actions, onBack, onAdd, preparationActions }: { trip: SavedTrip; plan: TripPlan; preparationActions: PreparationActions; actions: BookingCardActions; onBack: () => void; onAdd: (kind: BookingKind) => void }) {
  useLanguage();
  const [freeOpen, setFreeOpen] = useState(false);
  const groups = bookingGroups(trip.bookings), counts = checklistCounts(groups.preparation);
  const review = dateReviewCount(trip), freeReview = dateReviewCount({ ...trip, bookings: groups.freeVisits }) > 0;
  const showFree = freeOpen || freeReview;
  return <>
    <Text style={s.subtitle}>{trip.title} · {plan.days.length}天{plan.budget ? ` · ${plan.budget.travelers}人` : ''}</Text>
    <Text style={s.note}>待准备 {counts.pending}项 · 已完成 {counts.completed}项</Text>
    {review > 0 && <Text accessibilityRole="alert" style={s.note}>{review}项日期待核对</Text>}
    <TripPreparationPanel trip={trip} actions={preparationActions} />
    {[...groups.preparation].sort((a, b) => a.day - b.day).map(item => <TripBookingCard key={item.id} item={item} {...actions} />)}
    {!trip.bookings.length && <Text style={s.note}>确认建议后，准备事项会保存在这里。</Text>}
    {!!groups.freeVisits.length && <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFree, disabled: freeReview }} disabled={freeReview} onPress={() => setFreeOpen(!freeOpen)} style={[s.row, s.link]}><Text style={[s.note, s.grow]}>已保存的免费参观安排 · {groups.freeVisits.length}项</Text><AppIcon name={showFree ? 'close' : 'chevron'} size={16} /></Pressable>
      {showFree && groups.freeVisits.map(item => <TripBookingCard key={item.id} item={item} {...actions} />)}
    </>}
    <TripAddPreparation busy={actions.busy} onAdd={onAdd} />
    <Text style={s.note}>预订在外部网站完成，完成后手动勾选。</Text>
    <Pressable accessibilityRole="button" onPress={onBack} style={s.link}><View style={s.row}><AppIcon name="back" size={16} /><Text style={s.linkText}>返回每日安排</Text></View></Pressable>
  </>;
}
