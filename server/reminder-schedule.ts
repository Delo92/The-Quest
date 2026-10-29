const REMINDER_TIMEZONE = "America/Chicago";
const DAILY_SCAN_HOUR = 9;

function getCentralParts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: REMINDER_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function centralWallTimeToUtc(year: number, month: number, day: number, hour: number): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour);
  const localPartsAtGuess = getCentralParts(new Date(utcGuess));
  const representedUtc = Date.UTC(
    localPartsAtGuess.year,
    localPartsAtGuess.month - 1,
    localPartsAtGuess.day,
    localPartsAtGuess.hour,
    localPartsAtGuess.minute,
    localPartsAtGuess.second,
  );
  return utcGuess - (representedUtc - utcGuess);
}

export function getCentralDayKey(date: Date): string {
  const { year, month, day } = getCentralParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function hasReminderAttemptedToday(
  lastAttemptDay: string | null | undefined,
  lastAttemptAt: string | null | undefined,
  now: Date,
): boolean {
  let previousDay = lastAttemptDay || null;
  if (!previousDay && lastAttemptAt) {
    const previousAttempt = new Date(lastAttemptAt);
    if (Number.isFinite(previousAttempt.getTime())) {
      previousDay = getCentralDayKey(previousAttempt);
    }
  }
  return previousDay === getCentralDayKey(now);
}

export function nextDailyScanAt(now: Date): Date {
  const centralNow = getCentralParts(now);
  const todayAtNine = centralWallTimeToUtc(
    centralNow.year,
    centralNow.month,
    centralNow.day,
    DAILY_SCAN_HOUR,
  );
  if (now.getTime() < todayAtNine) return new Date(todayAtNine);

  const tomorrow = new Date(Date.UTC(centralNow.year, centralNow.month - 1, centralNow.day + 1));
  return new Date(centralWallTimeToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    DAILY_SCAN_HOUR,
  ));
}

export function hasDailyScanPassed(now: Date): boolean {
  const centralNow = getCentralParts(now);
  const todayAtNine = centralWallTimeToUtc(
    centralNow.year,
    centralNow.month,
    centralNow.day,
    DAILY_SCAN_HOUR,
  );
  return now.getTime() >= todayAtNine;
}
