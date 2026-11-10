import { UiText as Text } from '@/components/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { TripBooking } from '@/lib/saved-trips';
import { bookingCriteria, tripBookingLink } from '@/lib/trip-booking-links';
import { TripButton, TripSheet, tripStyles as s } from './trip-controls';

export function TripBookingDestination({ item, busy, error, notice, onClose, onOpenUrl, onCopy, onEdit, children }: {
  children?: ReactNode; item: TripBooking; busy: boolean; error: string; notice: string; onClose: () => void;
  onOpenUrl: (url: string) => void; onCopy: () => void; onEdit: () => void;
}) {
  const link = tripBookingLink(item);
  return <TripSheet title="选择查询入口" busy={busy} onClose={onClose}>
    <View style={s.card}><Text style={s.section}>这项暂未匹配到准确页面</Text><Text style={s.note}>不会把景点、车票或机票送到通用酒店搜索。下面是当前条件，可先修改，也可复制后到对应频道手动查找。</Text></View>
    <Text selectable style={s.body}>{bookingCriteria(item)}</Text>
    <TripButton secondary label="修改地点或路线" disabled={busy} onPress={onEdit} />
    <TripButton secondary label="复制查询条件" disabled={busy} onPress={onCopy} />
    <TripButton label={link.fallback.label} disabled={busy} onPress={() => onOpenUrl(link.fallback.url)} />
    <Text style={s.note}>此按钮只打开对应频道，不代表已填好条件、查到库存或已有可买产品。请在网站确认日期、人数和票种。</Text>
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.note}>{notice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {children}
  </TripSheet>;
}
