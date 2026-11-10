import { UiText as Text } from '@/components/ui';
import { View } from 'react-native';
import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';

import { parseTripPlan, validDate, inferDepartureCity, conversationDeparture } from '@/lib/saved-trips';
import { plannerHistory } from '@/lib/planner-history-storage';
import { savedTrips } from '@/lib/saved-trips-storage';
import { TripButton, TripField, TripSheet, tripStyles as s } from './trip-controls';

export function SaveTripButton({ reply, conversationId, messageId, disabled = false }: { reply: string; conversationId: string; messageId: string; disabled?: boolean }) {
  const plan = useMemo(() => parseTripPlan(reply), [reply]);
  const [open, setOpen] = useState(false), [title, setTitle] = useState(''), [date, setDate] = useState(''), [departure, setDeparture] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!plan) return null;
  async function openSave() {
    if (!plan) return;
    setTitle(plan.title); setDate(''); setError('');
    let origin = inferDepartureCity(plan.introduction);
    try {
      const conversation = (await plannerHistory.load()).find(c => c.id === conversationId);
      if (conversation) origin = conversationDeparture(conversation.messages, messageId) || origin;
    } catch { /* Saving a valid reply must still work when chat history is unavailable. */ }
    setDeparture(origin); setOpen(true);
  }
  async function save() {
    if (lock.current) return;
    if (!title.trim()) { setError('请给这份行程起个名字。'); return; }
    if (date && !validDate(date)) { setError('出发日期请用有效的 YYYY-MM-DD 格式，也可以先留空。'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const saved = await savedTrips.save({ sourceConversationId: conversationId, sourceMessageId: messageId, title: title.trim(), reply, startDate: date, departureCity: departure.trim() });
      setOpen(false); router.navigate({ pathname: '/trips', params: { tripId: saved.id } });
    } catch (e) { setError(e instanceof Error ? e.message : '行程暂未保存成功，请稍后再试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <View style={{ marginTop: 20 }}><TripButton label="保存到行程" disabled={disabled} onPress={() => { void openSave(); }} /></View>
    {open && <TripSheet title="保存这份旅行方案" onClose={() => setOpen(false)} busy={busy}>
      <Text style={s.note}>保存当前回复的独立副本。后续聊天修改或删除聊天记录，都不会覆盖这份已选方案。仅保存在当前设备。同一条回复已保存时会打开已有行程，可在那里修改名称和日期。</Text>
      <TripField label="行程名称" value={title} onChangeText={setTitle} />
      <TripField label="出发日期（可稍后填写）" value={date} onChangeText={setDate} maxLength={10} placeholder="YYYY-MM-DD" />
      <TripField label="出发城市" value={departure} onChangeText={setDeparture} placeholder="例如东京；不确定可稍后补充" />
      <Text style={s.note}>按路线和活动整理交通、住宿与参观准备；所有建议需确认，不自动订票。</Text>
      <Text style={s.body}>{plan.days.length}天{plan.budget ? ` · ${plan.budget.travelers}人 · ${plan.budget.currency === 'JPY' ? '日元' : '人民币'}预算` : ' · 人数与预算以原方案为准'}</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <TripButton label={busy ? '正在保存…' : '保存并查看行程'} disabled={busy} onPress={() => { void save(); }} />
    </TripSheet>}
  </>;
}
