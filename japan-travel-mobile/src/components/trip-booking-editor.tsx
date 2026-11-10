import { UiText as Text } from '@/components/ui';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { bookingProblem, type SavedTrip, type TripBooking } from '@/lib/saved-trips';
import { savedTrips } from '@/lib/saved-trips-storage';
import { tripBookingLink } from '@/lib/trip-booking-links';
import { TripButton, TripField, TripSheet, tripStyles as s } from './trip-controls';

export const bookingLabels = { hotel: '酒店', flight: '机票', train: '车票', attraction: '门票 / 体验' };
export function TripBookingEditor({ trip, initial, onClose, onSaved }: { trip: SavedTrip; initial: TripBooking; onClose: () => void; onSaved: (trip: SavedTrip) => void }) {
  const [item, setItem] = useState(initial), [people, setPeople] = useState(initial.people ? String(initial.people) : ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const link = tripBookingLink(item);
  function field(key: keyof TripBooking, value: string) { setItem(previous => ({ ...previous, [key]: value })); }
  async function save() {
    if (lock.current) return;
    const candidate = { ...item, city: item.city.trim(), from: item.from.trim(), to: item.to.trim(), name: item.name.trim(), people: Number(people) };
    const problem = bookingProblem(candidate);
    if (problem) { setError(problem); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const updated = await savedTrips.update(trip.id, previous => {
        if (previous.startDate !== trip.startDate) throw Error('行程出发日期已变化，请关闭后重新核对。');
        const confirmed = { ...candidate, dateConfirmedForStartDate: previous.startDate };
        return { ...previous, bookings: previous.bookings.some(b => b.id === candidate.id)
          ? previous.bookings.map(b => b.id === candidate.id ? { ...confirmed, booked: b.booked } : b)
          : [...previous.bookings, { ...confirmed, booked: false }] };
      });
      onSaved(updated); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '清单暂未保存，请稍后重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <TripSheet title={`${bookingLabels[item.kind]} · Day ${item.day}`} onClose={onClose} busy={busy}>
    <Text style={s.note}>保存即确认以上日期适用于当前出发日期：{trip.startDate || '未定'}。不会变更已完成状态。</Text>
    <Text style={s.note}>确认后加入待订清单，再打开 Trip.com 网页。此处不下单、不付款。</Text>
    {item.kind === 'hotel' && <><TripField label="实际住宿城市" value={item.city} onChangeText={v => field('city', v)} placeholder="例如札幌；当天游玩城市未必是住宿城市" />
      <Text style={s.note}>请确认过夜地点，避免把当天往返游览的城市当成住宿地。</Text></>}
    {(item.kind === 'flight' || item.kind === 'train') && <>
      <TripField label="出发城市" value={item.from} onChangeText={v => field('from', v)} placeholder="例如东京" />
      <TripField label="到达城市" value={item.to} onChangeText={v => field('to', v)} placeholder="例如札幌，不能只写北海道" />
    </>}
    {item.kind === 'attraction' && <><TripField label="景点所在城市" value={item.city} onChangeText={v => field('city', v)} /><TripField label="景点 / 体验名称" value={item.name} onChangeText={v => field('name', v)} />
      <Text style={s.note}>部分景点免费或需在官方渠道预约，是否售票以 Trip.com 实际提供为准。</Text></>}
    <TripField label={item.kind === 'hotel' ? '入住日期' : '使用 / 出发日期'} value={item.date} onChangeText={v => field('date', v)} maxLength={10} placeholder="YYYY-MM-DD" />
    {item.kind === 'hotel' && <TripField label="退房日期" value={item.endDate} onChangeText={v => field('endDate', v)} maxLength={10} placeholder="YYYY-MM-DD" />}
    <TripField label="出行总人数" value={people} onChangeText={setPeople} numeric maxLength={2} />
    <View style={s.card}><Text style={s.label}>{link.precision}</Text><Text style={s.note}>{link.freeEntry ? '该景点免费进入，附加体验或消费另计；此项用于记录参观安排。' : ''}{link.review}尚未匹配的项目会先显示查询入口选择，不会自动打开无关搜索结果。</Text></View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <TripButton disabled={busy} label={busy ? '正在保存…' : '确认并加入预订清单'} onPress={() => { void save(); }} />
  </TripSheet>;
}
