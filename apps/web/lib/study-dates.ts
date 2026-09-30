export function normalizeTimezoneOffset(value: number): number {
  return Number.isInteger(value) && value >= -840 && value <= 840 ? value : 0;
}

export function dateKeyAtOffset(now: Date, timezoneOffsetMinutes: number): string {
  const offset = normalizeTimezoneOffset(timezoneOffsetMinutes);
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
