import { View, StyleSheet } from 'react-native';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import type { SavedTrip, TripPlan } from '@/lib/saved-trips';
import { tripCover, tripDateRange } from '@/lib/trip-presentation';
import { colors, layout } from '@/lib/theme';
import { DiscoveryCoverPhoto } from './discovery-cover-photo';
import { TripPhotoCredits } from './trip-photo';
import { AppIcon } from './app-icon';

/** Reuses only an exact licensed sight from the saved plan. No photo API call. */
export function TripListCard({ trip, plan, onOpen }: { trip: SavedTrip; plan: TripPlan; onOpen: () => void }) {
  const image = tripCover(plan);
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`查看行程：${trip.title}`} onPress={onOpen}
      style={({ pressed }) => pressed && { opacity: 0.75 }}>
      <DiscoveryCoverPhoto cover={image?.cover ?? null} name={image?.name ?? trip.title} wide rounded={false} />
      <View style={styles.info}>
        <Text raw numberOfLines={2} style={styles.title}>{trip.title}</Text>
        <Text style={styles.meta}>{tripDateRange(trip, plan.days.length)} · {plan.days.length}天{plan.budget ? ` · ${plan.budget.travelers}人` : ''}</Text>
        <Text raw numberOfLines={2} style={styles.summary}>{plan.summary}</Text>
        <View style={styles.footer}><Text style={styles.link}>查看行程</Text><AppIcon name="diagonal" size={18} color={colors.action} /></View>
      </View>
    </Pressable>
    {image && <View style={styles.credits}><TripPhotoCredits name={image.name} cover={image.cover} showAuthor /></View>}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: layout.cardRadius, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  info: { padding: 14, paddingBottom: 0, gap: 7 },
  title: { color: colors.text, fontSize: 20, lineHeight: 29, fontWeight: '600' },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  summary: { color: colors.secondary, fontSize: 14, lineHeight: 23 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 5, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.action, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  credits: { paddingHorizontal: 14, paddingBottom: 4 },
});
