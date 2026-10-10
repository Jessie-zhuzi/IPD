export function addDaysUtc(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function startOfWeekUtc(date: Date) {
  const dow = date.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = (dow + 6) % 7; // Monday=0 ... Sunday=6
  return addDaysUtc(date, -offset);
}

export function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function previousMonthStartUtc(monthStartUtc: Date) {
  return startOfMonthUtc(addDaysUtc(monthStartUtc, -1));
}

export function previousMonthStartByCountUtc(monthStartUtc: Date, months: number) {
  return new Date(Date.UTC(monthStartUtc.getUTCFullYear(), monthStartUtc.getUTCMonth() - months, 1));
}

