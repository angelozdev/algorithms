import { TZDate } from "@date-fns/tz";

/** One calendar day, in milliseconds (only for durations: calendar math goes through the helpers below). */
export const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The local calendar date ("YYYY-MM-DD") of `at` in `timezone` (spec §6.3: the day boundary is local midnight). */
export function localDate(at: Date, timezone: string): string {
  const local = new TZDate(at.getTime(), timezone);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** `date` moved by `days` calendar days ("2026-10-31" + 1 → "2026-11-01"). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to`, both "YYYY-MM-DD" (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The instant local midnight starts `date` in `timezone`, daylight saving time included. */
export function startOfLocalDay(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(new TZDate(year, month - 1, day, timezone).getTime());
}

export interface LocalDay {
  /** "YYYY-MM-DD" in the profile's time zone. */
  date: string;
  /** Local midnight that starts the day. */
  start: Date;
  /** Local midnight that starts the next day: "due today" means due before this. */
  end: Date;
}

/** The local day `at` falls in. */
export function localDay(at: Date, timezone: string): LocalDay {
  const date = localDate(at, timezone);
  return { date, start: startOfLocalDay(date, timezone), end: startOfLocalDay(addDays(date, 1), timezone) };
}
