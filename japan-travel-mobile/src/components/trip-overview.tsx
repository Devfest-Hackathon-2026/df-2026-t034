import { localizePlanOutline } from '@/lib/i18n/core';
import { useLanguage } from '@/components/language-provider';
import { UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { SavedTrip, TripPlan } from '@/lib/saved-trips';
import { budgetTiers } from '@/lib/trip-budget';
import { bookingGroups } from '@/lib/trip-booking-display';
import { tripDate, dateReviewCount } from '@/lib/saved-trips';
import { budgetSummary, checklistCounts, shortDate, tripCover, tripDateRange } from '@/lib/trip-presentation';
import { discoveryCover } from '@/lib/discovery-covers';
import { colors } from '@/lib/theme';
import { tripPreparation } from '@/lib/trip-preparation';
import { type PreparationActions } from './trip-preparation-panel';
import { TripPhoto } from './trip-photo';
import { AppIcon } from './app-icon';
import { DiscoveryCoverPhoto } from './discovery-cover-photo';
import { tripViewStyles as s } from './trip-view-styles';

export function TripOverview({ trip, plan, onDay, onBudget, onChecklist }: { trip: SavedTrip; plan: TripPlan; preparationActions: PreparationActions; onDay: (day: number) => void; onBudget: () => void; onChecklist: () => void }) {
  const { intl, language } = useLanguage();
  const [summaryOpen, setSummaryOpen] = useState(false), [routeOpen, setRouteOpen] = useState(false);
  const cover = tripCover(plan), budget = budgetSummary(plan, trip.budgetTier ?? 0), counts = checklistCounts(bookingGroups(trip.bookings).preparation), first = plan.days[0], sight = first.sights[0];
  const preparation = tripPreparation(trip);
  const pending = counts.pending + preparation.suggestions.length;
  const previewCover = sight ? discoveryCover({ name: sight.name, city: first.city }) : null;
  return <>
    {cover && <TripPhoto name={cover.name} cover={cover.cover} />}
    <View style={{ gap: 6 }}><Text raw accessibilityRole="header" style={s.title}>{trip.title}</Text><Text style={s.subtitle}>{tripDateRange(trip, plan.days.length)} · {plan.days.length}天{plan.budget ? ` · ${plan.budget.travelers}人` : ''}</Text></View>
    {dateReviewCount(trip) > 0 && <Pressable accessibilityRole="button" onPress={onChecklist} style={s.card}><Text style={s.label}>{dateReviewCount(trip)}项预订日期待核对</Text><Text style={s.note}>出发日期已调整。原预订日期与完成状态均保留，请在准备清单逐项核对。</Text></Pressable>}
    {budget && <Pressable accessibilityRole="button" accessibilityLabel="查看旅行预算明细" onPress={onBudget} style={[s.card, { backgroundColor: colors.selected, borderColor: colors.selected, padding: 14, gap: 4 }]}>
      <View style={[s.wrap, { justifyContent: 'space-between' }]}><Text style={s.label}>旅行预算</Text><Text style={s.amount}>¥{Math.round(budget.total).toLocaleString(intl)}</Text></View>
      <View style={[s.wrap, { justifyContent: 'space-between', gap: 6 }]}><Text style={s.note}>{budgetTiers[trip.budgetTier ?? 0]} · {budget.travelers}人合计 · {budget.currency}估算</Text><Text style={s.linkText}>查看预算明细 ›</Text></View>
    </Pressable>}
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: summaryOpen }} onPress={() => setSummaryOpen(!summaryOpen)} style={[s.row, { minHeight: 52 }]}><Text style={[s.label, s.grow]}>旅行总结</Text><AppIcon name={summaryOpen ? 'close' : 'chevron'} size={18} /></Pressable>
      {summaryOpen && <Text raw selectable style={[s.body, { paddingBottom: 16 }]}>{plan.summary}</Text>}
      {!!plan.overview && <><View style={s.divider} /><Pressable accessibilityRole="button" accessibilityState={{ expanded: routeOpen }} onPress={() => setRouteOpen(!routeOpen)} style={[s.row, { minHeight: 52 }]}><Text style={[s.label, s.grow]}>路线概览</Text><AppIcon name={routeOpen ? 'close' : 'chevron'} size={18} /></Pressable>{routeOpen && <Text selectable style={[s.body, { paddingBottom: 16 }]}>{localizePlanOutline(plan.overview, language)}</Text>}</>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="查看出发前预订清单" onPress={onChecklist} style={s.shortcut}>
      <View style={s.grow}><Text style={s.label}>出发前准备</Text><Text style={s.note}>{pending ? `还有${pending}项待准备` : counts.total ? '准备事项已全部勾选' : '查看建议与准备清单'}{counts.completed ? ` · 已完成${counts.completed}项` : ''}</Text>
        {!!preparation.questions.length && <Text style={s.note}>还有{preparation.questions.length}项信息待确认</Text>}
      </View><AppIcon name="diagonal" size={18} color={colors.action} />
    </Pressable>
    <Text accessibilityRole="header" style={s.section}>每日安排</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{plan.days.map(day => <Pressable key={day.number} accessibilityRole="button" accessibilityLabel={`查看Day ${day.number}安排`} onPress={() => onDay(day.number)} style={[s.dayTab, day.number === 1 && s.activeTab]}><Text style={[s.tabText, day.number === 1 && s.activeTabText]}>Day {day.number}</Text></Pressable>)}</ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={`查看第一天：${first.title}`} onPress={() => onDay(first.number)} style={s.card}>
      <Text style={s.label}>{trip.startDate ? shortDate(tripDate(trip.startDate, first.number)) : 'Day 1'} · {first.title}</Text>
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        {previewCover && <View style={{ width: 90, borderRadius: 10, overflow: 'hidden' }}><DiscoveryCoverPhoto cover={previewCover} name={sight.name} wide /></View>}
        <View style={s.grow}><Text raw style={s.label}>{sight?.name || first.city || '第一天安排'}</Text><Text raw numberOfLines={2} style={s.note}>{sight?.description || first.activities[0]}</Text></View><AppIcon name="diagonal" size={18} />
      </View>
      {previewCover && <Text style={s.note}>资料照片，作者与许可见当天景点图片。</Text>}
    </Pressable>
  </>;
}
