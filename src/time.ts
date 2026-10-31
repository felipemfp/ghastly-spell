// Brazil has had no daylight saving time since 2019, so Brasília is a fixed UTC-3.
// Shifting by a constant keeps every function here independent of the runtime's timezone.
const BRT_OFFSET_MS = -3 * 3600_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const pad = (n: number) => String(n).padStart(2, "0");

function brtParts(utc: Date) {
  const d = new Date(utc.getTime() + BRT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

export function todayBrt(now: Date): string {
  const p = brtParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toUtc(dateBrt: string, hhmm: string): string {
  return new Date(`${dateBrt}T${hhmm}:00-03:00`).toISOString();
}

// Sportune dates have no year. Pick the year that puts the date between 30 days ago and 330 days ahead.
export function inferYear(day: number, month: number, now: Date): number {
  const today = Date.parse(`${todayBrt(now)}T00:00:00Z`);
  const year = brtParts(now).year;
  for (const y of [year - 1, year, year + 1]) {
    const diffDays = (Date.UTC(y, month - 1, day) - today) / DAY_MS;
    if (diffDays >= -30 && diffDays <= 330) return y;
  }
  return year;
}

export function formatCardDateTime(utcIso: string): string {
  const p = brtParts(new Date(utcIso));
  return `${WEEKDAYS[p.weekday]} ${pad(p.day)}/${pad(p.month)} ${pad(p.hh)}:${pad(p.mm)}`;
}

export function formatCardDate(dateBrt: string): string {
  const d = new Date(`${dateBrt}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}
