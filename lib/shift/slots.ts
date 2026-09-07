import type { SlotGenerationSettings, TimeSlot } from "./types";

const TIME_RE = /^([0-9]{1,2}):([0-9]{2})$/;

/** "10:00" 形式の文字列を分に変換する。不正な形式は null */
export function parseTimeToMinutes(value: string): number | null {
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (minutes < 0 || minutes > 59 || hours < 0) return null;
  return hours * 60 + minutes;
}

/** 分を "10:00" 形式の文字列に変換する */
export function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

/** "2026-09-13" 形式で、実在するカレンダー上の日付かどうかを検証する */
export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value.trim());
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** "2026-09-13" を "9/13" のような短い表示形式に変換する(年は表示しない) */
export function formatDateShort(value: string): string {
  const m = DATE_RE.exec(value.trim());
  if (!m) return value;
  return `${Number(m[2])}/${Number(m[3])}`;
}

/** 一括生成設定を検証し、問題があれば日本語のエラーメッセージ一覧を返す */
export function validateSlotGeneration(settings: SlotGenerationSettings): string[] {
  const errors: string[] = [];
  if (!isValidDate(settings.date)) errors.push("対象日を選択してください。");
  const start = parseTimeToMinutes(settings.start);
  const end = parseTimeToMinutes(settings.end);
  if (start === null) errors.push("開始時刻の形式が不正です。");
  if (end === null) errors.push("終了時刻の形式が不正です。");
  if (start !== null && end !== null && start >= end) {
    errors.push("終了時刻は開始時刻より後にしてください。");
  }
  if (!Number.isFinite(settings.intervalMinutes) || settings.intervalMinutes <= 0) {
    errors.push("1コマの長さは1分以上にしてください。");
  }
  settings.breaks.forEach((b, i) => {
    const bs = parseTimeToMinutes(b.start);
    const be = parseTimeToMinutes(b.end);
    if (bs === null || be === null) {
      errors.push(`休憩時間${i + 1}の時刻形式が不正です。`);
    } else if (bs >= be) {
      errors.push(`休憩時間${i + 1}は終了時刻が開始時刻より後である必要があります。`);
    }
  });
  return errors;
}

/**
 * 対象日の開始〜終了時刻を1コマの長さで分割して時間枠を生成する。
 * 休憩時間帯と重なるコマは生成しない。設定が不正な場合は空配列を返す。
 */
export function generateSlots(
  settings: SlotGenerationSettings,
  defaultCapacity = 1
): TimeSlot[] {
  if (validateSlotGeneration(settings).length > 0) return [];

  const start = parseTimeToMinutes(settings.start)!;
  const end = parseTimeToMinutes(settings.end)!;
  const interval = settings.intervalMinutes;
  const breaks = settings.breaks
    .map((b) => ({ start: parseTimeToMinutes(b.start), end: parseTimeToMinutes(b.end) }))
    .filter((b): b is { start: number; end: number } => b.start !== null && b.end !== null);

  const slots: TimeSlot[] = [];
  for (let t = start; t + interval <= end; t += interval) {
    const slotEnd = t + interval;
    const overlapsBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
    if (overlapsBreak) continue;
    slots.push({
      id: crypto.randomUUID(),
      date: settings.date,
      start: formatMinutesToTime(t),
      end: formatMinutesToTime(slotEnd),
      capacity: defaultCapacity,
    });
  }
  return slots;
}
