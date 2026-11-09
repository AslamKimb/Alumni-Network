export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function nextOccurrence(date: Date, freq: RecurrenceFreq, interval: number): Date {
  const step = Math.max(1, Math.floor(interval) || 1);
  if (freq === "daily") {
    const next = new Date(date);
    next.setDate(next.getDate() + step);
    return next;
  }
  if (freq === "weekly") {
    const next = new Date(date);
    next.setDate(next.getDate() + 7 * step);
    return next;
  }
  return addMonths(date, step);
}

export function countOccurrences(input: {
  startsAt: string;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceEnd: string;
  exceptionDates: string[];
}): number | null {
  if (!input.startsAt || !input.recurrenceEnd) return null;
  const start = new Date(input.startsAt);
  const end = new Date(input.recurrenceEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  if (end < start) return 0;
  const exceptionSet = new Set(input.exceptionDates.map((d) => d.slice(0, 10)));
  let count = 0;
  let current = new Date(start);
  for (let guard = 0; guard < 1000; guard++) {
    if (current > end) break;
    if (!exceptionSet.has(localDateKey(current))) count++;
    current = nextOccurrence(current, input.recurrenceFreq, input.recurrenceInterval);
  }
  return count;
}
