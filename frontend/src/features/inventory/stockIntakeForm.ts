export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayDateValue(date = new Date()): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

export function currentDateTimeLocal(date = new Date()): string {
  return `${todayDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datePartFromDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 10);
}

function localDateFromDateValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function daysUntilDate(value: string): number | null {
  const date = localDateFromDateValue(value);
  if (date === null) {
    return null;
  }
  const today = localDateFromDateValue(todayDateValue());
  if (today === null) {
    return null;
  }
  return Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function formatDateTimeSummary(value: string): string {
  if (!value) {
    return "Not set";
  }
  const [datePart, timePart = ""] = value.split("T");
  const date = localDateFromDateValue(datePart);
  if (date === null) {
    return value;
  }
  const [hours = "00", minutes = "00"] = timePart.split(":");
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
