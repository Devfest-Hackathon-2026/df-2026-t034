import { useLanguage } from '@/components/language-provider';
import { localizeTimingHints } from '@/lib/i18n/core';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { ScrollView, View } from 'react-native';
import type { BookingKind, SavedTrip, TripDay, TripPlan } from '@/lib/saved-trips';
import { bookingDisplay } from '@/lib/trip-booking-display';
import { tripDate, bookingNeedsDateReview } from '@/lib/saved-trips';
import { dayPresentation, shortDate } from '@/lib/trip-presentation';
import { tripBookingLink } from '@/lib/trip-booking-links';
import { TripBookingCard, type BookingCardActions } from './trip-booking-card';
import { TripPreparationPanel, type PreparationActions } from './trip-preparation-panel';
import { TripPhoto } from './trip-photo';
import { TripAdmissionInfo } from './trip-admission-info';
import { AppIcon } from './app-icon';
import { TripAddPreparation } from './trip-add-preparation';
import { tripViewStyles as s } from './trip-view-styles';

export function TripDayTabs({ plan, selected, onDay }: { plan: TripPlan; selected: number; onDay: (number: number) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} style={{ flexGrow: 0 }}>
    {plan.days.map(day => <Pressable key={day.number} accessibilityRole="tab" accessibilityLabel={`Day ${day.number}`} accessibilityState={{ selected: selected === day.number }} onPress={() => onDay(day.number)} style={[s.dayTab, selected === day.number && s.activeTab]}>
      <Text style={[s.tabText, selected === day.number && s.activeTabText]}>Day {day.number}</Text>
    </Pressable>)}
  </ScrollView>;
}
export function TripDayView({ trip, day, actions, onAdd, onMap, onChecklist, preparationActions }: {
  trip: SavedTrip; day: TripDay; preparationActions: PreparationActions; actions: BookingCardActions; onAdd: (kind: BookingKind, name?: string) => void; onMap: (name: string) => void; onChecklist: () => void;
}) {
  const { language } = useLanguage();
  const view = dayPresentation(day, trip.bookings, tripDate(trip.startDate, day.number));
  const visibleBooking = (item: SavedTrip['bookings'][number]) => !bookingDisplay(item).freeOnly || bookingNeedsDateReview(trip, item);
  const unplaced = view.unplacedBookings.filter(visibleBooking);
  function sightInfo(sight: TripDay['sights'][number]) {
    const { freeEntry: free, admission } = tripBookingLink({ kind: 'attraction', city: day.city, name: sight.name, from: '', to: '' });
    return <View key={sight.name} style={{ gap: 10 }}>
      <Text raw style={s.label}>{sight.name}</Text><Text raw selectable style={s.subtitle}>{sight.description}</Text>
      <TripPhoto name={sight.name} city={day.city} />
      <View style={s.wrap}><Pressable accessibilityRole="button" accessibilityLabel={`在地图查看${sight.name}`} onPress={() => onMap(sight.name)} style={[s.smallButton, s.secondaryButton, s.row]}><AppIcon name="map" size={18} /><Text style={s.linkText}>地图查看</Text></Pressable>
        {free && !admission && <Text style={s.note}>免费参观</Text>}
      </View>
      {admission && <TripAdmissionInfo evidence={admission} />}
    </View>;
  }
  return <>
    <View style={{ gap: 6 }}><Text style={s.subtitle}>{shortDate(tripDate(trip.startDate, day.number), true)}</Text><Text accessibilityRole="header" style={s.section}>Day {day.number}｜{day.title}</Text></View>
    {view.rows.map(row => <View key={`${day.number}-${row.index}`} style={s.activity}>
      <View style={[s.row, { alignItems: 'flex-start' }]}><Text style={s.number}>{String(row.index + 1).padStart(2, '0')}</Text><Text raw selectable style={[s.body, s.grow]}>{localizeTimingHints(row.text, language)}</Text></View>
      {row.sights.map(sightInfo)}
      {row.bookings.filter(visibleBooking).map(item => <TripBookingCard key={item.id} item={item} contextual {...actions} />)}
    </View>)}
    {!!view.unplacedSights.length && <><Text style={s.section}>当天景点资料</Text><Text style={s.note}>原方案未明确放在哪条活动中，以下保留对应介绍。</Text>{view.unplacedSights.map(sight => <View key={sight.name} style={s.activity}>{sightInfo(sight)}</View>)}</>}
    <TripPreparationPanel trip={trip} day={day.number} actions={preparationActions} />
    {!!unplaced.length && <><Text style={s.section}>当天其他准备</Text>{unplaced.map(item => <TripBookingCard key={item.id} item={item} contextual {...actions} />)}</>}
    <TripAddPreparation busy={actions.busy} onAdd={onAdd} />
    <Pressable accessibilityRole="button" onPress={onChecklist} style={s.shortcut}><Text style={[s.label, s.grow]}>全部准备事项</Text><AppIcon name="diagonal" size={18} /></Pressable>
  </>;
}
