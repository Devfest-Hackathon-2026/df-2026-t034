import { UiActivityIndicator as ActivityIndicator, UiPressable as Pressable, UiText as Text } from '@/components/ui';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import { router, Tabs, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking, ScrollView, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { BudgetComparison } from '@/components/budget-comparison';
import { SaveTripButton } from '@/components/save-trip-button';
import { TripBookingDestination } from '@/components/trip-booking-destination';
import { TripBookingEditor } from '@/components/trip-booking-editor';
import { TripButton, TripField, TripSheet, tripStyles as s } from '@/components/trip-controls';
import { TripListCard } from '@/components/trip-list-card';
import { TripOverview } from '@/components/trip-overview';
import { TripDayTabs, TripDayView } from '@/components/trip-day-view';
import { TripChecklist } from '@/components/trip-checklist';
import { tripViewStyles as v } from '@/components/trip-view-styles';
import type { BookingCardActions } from '@/components/trip-booking-card';
import { parseTripPlan, validDate, newBookingDraft, inferDepartureCity, conversationDeparture, bookingNeedsDateReview, confirmBookingDates, type BookingKind, type SavedTrip, type TripBooking } from '@/lib/saved-trips';
import { savedTrips } from '@/lib/saved-trips-storage';
import { plannerHistory } from '@/lib/planner-history-storage';
import type { PlannerConversation } from '@/lib/planner-history';
import { tripBookingLink, bookingCriteria } from '@/lib/trip-booking-links';
import { discoveryMapUrl } from '@/lib/discovery';
import { acceptPreparation } from '@/lib/trip-preparation';
import type { PreparationActions } from '@/components/trip-preparation-panel';
import { colors } from '@/lib/theme';

type TripView = 'overview' | 'day' | 'checklist';
export default function TripsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]), [selected, setSelected] = useState(''), [dayNumber, setDayNumber] = useState(1);
  const [mode, setMode] = useState<TripView>('overview'), [checklistReturn, setChecklistReturn] = useState<TripView>('overview');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [destination, setDestination] = useState<TripBooking | null>(null);
  const [editor, setEditor] = useState<TripBooking | null>(null), [settings, setSettings] = useState(false), [history, setHistory] = useState<PlannerConversation[] | null>(null);
  const [busy, setBusy] = useState(false), [confirmDelete, setConfirmDelete] = useState(''), [menu, setMenu] = useState(false), [budget, setBudget] = useState(false);
  const lock = useRef(false);
  function top() { scrollRef.current?.scrollTo({ y: 0, animated: false }); }
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const latest = await savedTrips.load();
      // Backfill only explicit origin from this saved reply's own earlier user turns.
      // Never use another conversation or subsequent edits; leave existing choices alone.
      try {
        const conversations = await plannerHistory.load();
        for (let i = 0; i < latest.length; i++) {
          const item = latest[i];
          if (item.departureCity) continue;
          const conversation = conversations.find(c => c.id === item.sourceConversationId);
          const origin = conversation ? conversationDeparture(conversation.messages, item.sourceMessageId) : '';
          if (origin) latest[i] = await savedTrips.update(item.id, current => current.departureCity ? current : { ...current, departureCity: origin });
        }
      } catch { /* Existing trips remain readable if the optional source history is unavailable. */ }
      setTrips(latest);
      if (typeof tripId === 'string') {
        if (latest.some(t => t.id === tripId)) { setSelected(tripId); setDayNumber(1); setMode('overview'); }
        else setError('这份行程已不在本机，请从列表选择。');
        router.setParams({ tripId: undefined });
      }
    } catch { setError('无法读取本机行程，原记录已保留。请稍后重试。'); }
    finally { setLoading(false); }
  }, [tripId]);
  useFocusEffect(useCallback(() => { void reload(); return () => { setHistory(null); }; }, [reload]));
  const trip = trips.find(t => t.id === selected), plan = trip ? parseTripPlan(trip.reply) : null;
  const day = plan?.days.find(d => d.number === dayNumber) ?? plan?.days[0];
  const hasTrip = Boolean(trip && plan && day);
  function replace(updated: SavedTrip) { setTrips(previous => previous.map(t => t.id === updated.id ? updated : t)); }
  function back() {
    setConfirmDelete(''); setNotice(''); setError(''); top();
    if (mode === 'checklist') setMode(checklistReturn);
    else if (mode === 'day') setMode('overview');
    else { setSelected(''); setMode('overview'); }
  }
  function openDay(number: number) { setDayNumber(number); setMode('day'); setConfirmDelete(''); top(); }
  function openChecklist() { setChecklistReturn(mode === 'day' ? 'day' : 'overview'); setMode('checklist'); setConfirmDelete(''); top(); }
  async function change(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '这次操作没有完成，请稍后再试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  function handleAddBooking(kind: BookingKind, name = '') {
    if (!trip || !day) return;
    setEditor(newBookingDraft(trip, day, kind, name));
  }
  const actions: BookingCardActions = {
    busy, confirmDelete, tripStartDate: trip?.startDate ?? '',
    onConfirmDates: item => { if (trip) void change(async () => { replace(await savedTrips.update(trip.id, current => confirmBookingDates(current, trip, item))); }); },
    onOpen: item => {
      if (trip && bookingNeedsDateReview(trip, item)) { setEditor(item); return; }
      const link = tripBookingLink(item);
      const url = link.url;
      if (!url) { setNotice(''); setError(''); setDestination(item); return; }
      void change(async () => { await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.background, controlsColor: colors.text }); });
    },
    onOpenAlternative: (item, url) => {
      const allowed = tripBookingLink(item).alternatives.some(choice => choice.url === url);
      if (!allowed) return;
      if (trip && bookingNeedsDateReview(trip, item)) { setEditor(item); return; }
      void change(async () => { await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.background, controlsColor: colors.text }); });
    },
    onEdit: setEditor,
    onCopy: item => { void change(async () => { if (!await Clipboard.setStringAsync(bookingCriteria(item))) throw Error('未能复制，请稍后重试。'); setNotice('查询条件已复制，可在 Trip.com 核对或粘贴。'); }); },
    onToggle: item => { if (trip) void change(async () => { replace(await savedTrips.update(trip.id, current => ({ ...current, bookings: current.bookings.map(b => b.id === item.id ? { ...b, booked: !b.booked } : b) }))); }); },
    onRemove: item => {
      if (!trip) return;
      if (confirmDelete !== item.id) { setConfirmDelete(item.id); return; }
      void change(async () => { replace(await savedTrips.update(trip.id, current => ({ ...current, bookings: current.bookings.filter(b => b.id !== item.id) }))); setConfirmDelete(''); });
    },
  };
  const preparationActions: PreparationActions = {
    busy,
    onReview: suggestion => setEditor(suggestion.draft),
    onSettings: () => { setMenu(true); setSettings(true); },
    onAccept: ids => { if (trip) void change(async () => {
      replace(await savedTrips.update(trip.id, current => acceptPreparation(current, ids)));
      setNotice('已加入待办清单，尚未预订。请打开各项核对网站条件。');
    }); },
  };
  const candidates = history?.flatMap(c => c.messages.filter(m => m.role === 'assistant' && parseTripPlan(m.content)).map(m => ({ conversationId: c.id, messageId: m.id, reply: m.content, plan: parseTripPlan(m.content)! }))) ?? [];

  const bookingEditor = editor && trip ? <TripBookingEditor key={editor.id} trip={trip} initial={editor} onClose={() => setEditor(null)} onSaved={updated => { replace(updated); setDestination(null); setNotice('已加入准备清单，可在当天安排或全部清单中查看。'); }} /> : null;
  return <View style={v.screen}>
    <Tabs.Screen options={{ headerShown: false }} />
    <View style={[v.header, { paddingTop: insets.top + 6 }]}>
      {hasTrip ? <Pressable accessibilityRole="button" accessibilityLabel={mode === 'overview' ? '返回所有行程' : mode === 'day' ? '返回旅行总览' : '返回上一页'} onPress={back} style={v.headerSide}><AppIcon name="back" size={21} /></Pressable> : <View style={v.headerSide} />}
      <Text accessibilityRole="header" numberOfLines={2} style={v.headerTitle}>{hasTrip && mode === 'checklist' ? '出发前准备' : hasTrip && mode === 'day' ? trip?.title : '行程'}</Text>
      {hasTrip ? <Pressable accessibilityRole="button" accessibilityLabel="行程更多操作" disabled={busy} onPress={() => { setConfirmDelete(''); setMenu(true); }} style={v.headerSide}><AppIcon name="more" size={23} /></Pressable> : <View style={v.headerSide} />}
    </View>
    {hasTrip && mode === 'day' && plan && day && <View style={v.tabs}><TripDayTabs plan={plan} selected={day.number} onDay={openDay} /></View>}
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[v.content, { flexGrow: 1 }]}>
      {loading && <ActivityIndicator color={colors.secondary} accessibilityLabel="正在读取行程" />}
      {!!error && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><TripButton secondary disabled={busy} label="重新读取行程" onPress={() => { void reload(); }} /></View>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={v.note}>{notice}</Text>}
      {!trip || !plan || !day ? <>
        {!!trips.length && <><Text style={v.title}>我的旅行</Text><Text style={v.subtitle}>选好方案，再慢慢准备出发。</Text>
          {trips.map(item => {
            const p = parseTripPlan(item.reply)!;
            return <TripListCard key={item.id} trip={item} plan={p} onOpen={() => { setSelected(item.id); setDayNumber(1); setMode('overview'); setConfirmDelete(''); setError(''); setNotice(''); top(); }} />;
          })}</>}
        {!loading && !trips.length && <View style={v.empty}><AppIcon name="map" size={42} color={colors.secondary} /><Text style={[v.title, { textAlign: 'center' }]}>下一段旅行，从这里开始</Text><Text style={[v.subtitle, { textAlign: 'center' }]}>保存计划后，就能在这里查看每天的安排和出发前清单。</Text><TripButton label="规划一次旅行" onPress={() => router.navigate('/planner')} /></View>}
        <TripButton secondary disabled={busy || loading} label="从聊天记录选择方案" onPress={() => { void change(async () => { setHistory(await plannerHistory.load()); }); }} />
      </> : mode === 'overview' ? <TripOverview key={trip.id} trip={trip} plan={plan} preparationActions={preparationActions} onDay={openDay} onBudget={() => setBudget(true)} onChecklist={openChecklist} />
        : mode === 'day' ? <TripDayView trip={trip} day={day} actions={actions} preparationActions={preparationActions} onAdd={handleAddBooking} onChecklist={openChecklist} onMap={name => { void change(async () => { await Linking.openURL(discoveryMapUrl({ name, city: day.city })); }); }} />
        : <TripChecklist trip={trip} plan={plan} actions={actions} preparationActions={preparationActions} onBack={() => { setMode('day'); top(); }} onAdd={handleAddBooking} />}
    </ScrollView>
    {destination && <TripBookingDestination item={destination} busy={busy} error={error} notice={notice} onClose={() => setDestination(null)} onEdit={() => setEditor(destination)} onCopy={() => actions.onCopy(destination)} onOpenUrl={url => {
      if (url !== tripBookingLink(destination).fallback.url) return;
      void change(async () => { await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.background, controlsColor: colors.text }); });
    }}>{bookingEditor}</TripBookingDestination>}
    {!destination && bookingEditor}
    {budget && trip && plan?.budget && <TripSheet title="旅行预算明细" busy={busy} onClose={() => setBudget(false)}><BudgetComparison budget={plan.budget} selectedTier={trip.budgetTier ?? 0} disabled={busy} onTierChange={tier => { void change(async () => { replace(await savedTrips.update(trip.id, current => ({ ...current, budgetTier: tier }))); }); }} /><Text style={v.note}>{busy ? '正在保存预算档位…' : '档位保存在这份行程中，总览同步显示所选估算。沿用原币种和人数，实际费用以预订时为准。'}</Text>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}</TripSheet>}
    {menu && trip && <TripSheet title="行程选项" onClose={() => { setMenu(false); setSettings(false); }} busy={busy}>
      <TripButton secondary label="编辑行程名称与日期" disabled={busy} onPress={() => setSettings(true)} />
      <TripButton secondary label="查看全部准备事项" disabled={busy} onPress={() => { setMenu(false); openChecklist(); }} />
      <TripButton label="带着方案继续和 AI 讨论" disabled={busy} onPress={() => { setMenu(false); router.navigate({ pathname: '/planner', params: { continueTripId: trip.id } }); }} />
      <Text style={v.note}>将安排整理成新聊天草稿，发送前可以编辑；原行程保持独立保存。</Text>
      <TripButton secondary disabled={busy} label={confirmDelete === trip.id ? '再次点击，删除这份本机行程' : '删除这份行程'} onPress={() => {
        if (confirmDelete !== trip.id) { setConfirmDelete(trip.id); return; }
        void change(async () => { await savedTrips.remove(trip.id); setTrips(previous => previous.filter(t => t.id !== trip.id)); setSelected(''); setConfirmDelete(''); setMenu(false); setMode('overview'); });
      }} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {settings && <TripSettings trip={trip} onClose={() => setSettings(false)} onSaved={updated => { replace(updated); setSettings(false); setMenu(false); }} />}
    </TripSheet>}
    {history && <TripSheet title="从聊天选择已完成方案" onClose={() => setHistory(null)}><Text style={v.note}>只列出包含完整每日安排和小结的回复。保存不消耗 AI 或图片额度。</Text>{!candidates.length && <Text style={v.body}>尚未找到完整方案。请先在 AI 规划中完成行程。</Text>}{candidates.slice().reverse().map(c => <View key={`${c.conversationId}-${c.messageId}`} style={s.card}><Text style={v.section}>{c.plan.title}</Text><Text numberOfLines={2} style={v.body}>{c.plan.summary}</Text><SaveTripButton reply={c.reply} conversationId={c.conversationId} messageId={c.messageId} /></View>)}</TripSheet>}
  </View>;
}
function TripSettings({ trip, onSaved, onClose }: { trip: SavedTrip; onSaved: (trip: SavedTrip) => void; onClose: () => void }) {
  const [title, setTitle] = useState(trip.title), [date, setDate] = useState(trip.startDate), [departure, setDeparture] = useState(trip.departureCity || inferDepartureCity(parseTripPlan(trip.reply)?.introduction ?? '')), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    if (!title.trim() || (date && !validDate(date))) { setError('请填写名称；日期使用有效的 YYYY-MM-DD 格式，或留空。'); return; }
    lock.current = true; setBusy(true); setError('');
    try { onSaved(await savedTrips.update(trip.id, current => ({ ...current, title: title.trim(), startDate: date, departureCity: departure.trim() }))); onClose(); }
    catch { setError('未能保存修改，原行程已保留，请稍后重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <TripSheet title="行程信息" onClose={onClose} busy={busy}><TripField label="行程名称" value={title} onChangeText={setTitle} /><TripField label="出发日期" value={date} onChangeText={setDate} maxLength={10} placeholder="YYYY-MM-DD" />
    {date !== trip.startDate && trip.bookings.length > 0 && <Text accessibilityRole="alert" style={s.label}>保存后，{trip.bookings.length}项已有预订将提示核对日期。原日期和手动完成状态保持保留。</Text>}
    <TripField label="出发城市" value={departure} onChangeText={setDeparture} placeholder="例如东京；不要只填北海道等地区" />
    <Text style={s.note}>出发城市用于整理往返交通建议；已有预订路线不会自动改写。</Text>
    <Text style={s.note}>更改出发日期仅更新每日日期和新增事项的默认日期。已有预订清单里的日期不会自动移动，请逐项核对。</Text>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<TripButton disabled={busy} label={busy ? '正在保存…' : '保存修改'} onPress={() => { void save(); }} /></TripSheet>;
}
