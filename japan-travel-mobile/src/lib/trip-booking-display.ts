import { tripBookingLink } from './trip-booking-links.ts';
import type { TripBooking } from './saved-trips.ts';

export function bookingDisplay(item: TripBooking) {
  const link = tripBookingLink(item);
  const freeVisit = item.kind === 'attraction' && Boolean(link.freeEntry);
  const paidExtra = freeVisit ? link.alternatives[0] : undefined;
  const buttonLabel = freeVisit ? paidExtra?.shortLabel ?? paidExtra?.label ?? ''
    : link.admission?.status === 'reservation' ? '官方登记说明' : !link.located ? '选择入口' : link.entryKind === 'official' ? link.buttonLabel : item.kind === 'hotel' ? '查酒店' : item.kind === 'flight' ? '查航班' : item.kind === 'train' ? '查车票' : '票务信息';
  return { admission: link.admission, link, freeVisit, paidExtra, buttonLabel, showQuery: !freeVisit, freeOnly: freeVisit && !paidExtra };
}
export function bookingGroups(bookings: TripBooking[]) {
  const preparation: TripBooking[] = [], freeVisits: TripBooking[] = [];
  for (const booking of bookings) (bookingDisplay(booking).freeOnly ? freeVisits : preparation).push(booking);
  return { preparation, freeVisits };
}
