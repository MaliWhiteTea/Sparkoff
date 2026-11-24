/** Convert an Istanbul wall-clock minute to an instant without assuming a fixed UTC offset. */
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function istanbulParts(instant: Date) {
  const values = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

export function istanbulWallMinuteToUtc(date: string, time: string): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let milliseconds = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = istanbulParts(new Date(milliseconds));
    const [localYear, localMonth, localDay] = local.date.split('-').map(Number);
    const [localHour, localMinute] = local.time.split(':').map(Number);
    const wallMilliseconds = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute);
    const difference = Date.UTC(year, month - 1, day, hour, minute) - wallMilliseconds;
    if (difference === 0) break;
    milliseconds += difference;
  }
  const resolved = new Date(milliseconds);
  const local = istanbulParts(resolved);
  return local.date === date && local.time === time ? resolved : null;
}

type Interval = { startsAt: Date; endsAt: Date };
type Reservation = Interval & { status: string; verificationExpiresAt: Date | null };

export function availableStartTimes(input: {
  date: string; opensAt: string; latestStartAt: string; slotMinutes: number; durationMinutes: number;
  now: Date; blackouts: Interval[]; reservations: Reservation[];
}): string[] {
  const open = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(input.opensAt);
  const latest = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(input.latestStartAt);
  if (!open || !latest || ![15, 30, 60].includes(input.slotMinutes)) return [];
  const openMinute = Number(open[1]) * 60 + Number(open[0].slice(3, 5));
  const lastMinute = Number(latest[1]) * 60 + Number(latest[0].slice(3, 5));
  if (lastMinute < openMinute) return [];
  const slots: string[] = [];
  for (let minute = openMinute; minute <= lastMinute; minute += input.slotMinutes) {
    const label = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const start = istanbulWallMinuteToUtc(input.date, label);
    if (!start || start <= input.now) continue;
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    if (input.blackouts.some(row => row.startsAt < end && row.endsAt > start)) continue;
    if (input.reservations.some(row => row.startsAt < end && row.endsAt > start &&
      (row.status !== 'pending_verification' || !row.verificationExpiresAt || row.verificationExpiresAt > input.now))) continue;
    slots.push(label);
  }
  return slots;
}
