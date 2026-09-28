/**
 * "Nhip nghe" - thong ke thoi quen nghe nhac ca nhan.
 *
 * Vi sao tach rieng khoi service (thuan JS, khong cham CSDL):
 *  - Cac phep tinh nay rat de sai o vien (moc ngay theo GIO DIA PHUONG, chuoi ngay lien tiep,
 *    gom gio thanh khung) va neu viet lan trong service thi khong test duoc.
 *  - `npm run check:insights` chay truc tiep tren cac ham nay voi du lieu gia.
 *
 * LUU Y ve mui gio: khac voi `stats.service` (dashboard dung ngay UTC de gop theo CSDL),
 * thong ke CA NHAN lay theo gio dia phuong cua nguoi nghe - "gio vang 20h-23h" chi co y
 * nghia khi dung dung dong ho cua nguoi do.
 */
export const DAY_MS = 86_400_000;

/** Ngay theo gio dia phuong, dang `yyyy-mm-dd` (dung lam khoa gom nhom) */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Moc 00:00 cua ngay dia phuong chua `date` */
export function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export interface DayPlayCount {
  date: string;
  plays: number;
}

/** Dem luot nghe theo tung ngay trong `days` ngay gan nhat (ngay cuoi = hom nay) */
export function buildDailyTrend(timestamps: Date[], days: number, now: Date = new Date()): DayPlayCount[] {
  const total = Math.max(1, Math.round(days));
  const counts = new Map<string, number>();

  for (const stamp of timestamps) {
    const key = localDayKey(stamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfLocalDay(now);
  const trend: DayPlayCount[] = [];

  for (let offset = total - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    const key = localDayKey(date);
    trend.push({ date: key, plays: counts.get(key) ?? 0 });
  }

  return trend;
}

export interface HourBucket {
  label: string;
  fromHour: number;
  toHour: number;
  plays: number;
}

/** Gom luot nghe theo khung gio trong ngay (mac dinh 3 gio/khung) de thay "gio vang" */
export function buildHourBuckets(timestamps: Date[], bucketSize = 3): HourBucket[] {
  const size = Math.min(Math.max(Math.round(bucketSize) || 3, 1), 24);
  const buckets: HourBucket[] = [];

  for (let fromHour = 0; fromHour < 24; fromHour += size) {
    const toHour = Math.min(fromHour + size - 1, 23);
    buckets.push({
      fromHour,
      toHour,
      label: `${fromHour}h–${toHour}h`,
      plays: 0,
    });
  }

  for (const stamp of timestamps) {
    const index = Math.min(Math.floor(stamp.getHours() / size), buckets.length - 1);
    if (index >= 0) buckets[index].plays += 1;
  }

  return buckets;
}

/** Khung gio nghe nhieu nhat (null khi chua co luot nghe nao) */
export function peakHourBucket(buckets: HourBucket[]): HourBucket | null {
  let best: HourBucket | null = null;

  for (const bucket of buckets) {
    if (bucket.plays <= 0) continue;
    if (!best || bucket.plays > best.plays) best = bucket;
  }

  return best;
}

export interface StreakInfo {
  /** So ngay lien tiep dang keo dai (tinh tới hom nay, hoac hom qua neu hom nay chua nghe) */
  current: number;
  /** Chuoi dai nhat trong du lieu dang co */
  longest: number;
  /** Hom nay da nghe chua (UI dung de hien "hom nay chua nghe" va giu chuoi) */
  listenedToday: boolean;
}

/**
 * Tinh chuoi ngay nghe lien tiep.
 *
 * Quy uoc: hom nay CHUA nghe thi chuoi van tinh tới hom qua (nguoi dung con nguyen "streak"
 * tới het ngay). Nho vay UI khong bao "mat chuoi" chi vi sang som chua kip mo nhac.
 */
export function buildStreak(timestamps: Date[], now: Date = new Date()): StreakInfo {
  if (timestamps.length === 0) return { current: 0, longest: 0, listenedToday: false };

  const days = new Set(timestamps.map((stamp) => localDayKey(stamp)));
  const today = startOfLocalDay(now);
  const todayKey = localDayKey(today);
  const yesterdayKey = localDayKey(new Date(today.getTime() - DAY_MS));

  const listenedToday = days.has(todayKey);

  let current = 0;
  const anchorKey = listenedToday ? todayKey : yesterdayKey;
  let cursor = new Date(listenedToday ? today.getTime() : today.getTime() - DAY_MS);

  if (days.has(anchorKey)) {
    current = 1;
    for (;;) {
      cursor = new Date(cursor.getTime() - DAY_MS);
      if (!days.has(localDayKey(cursor))) break;
      current += 1;
    }
  }

  // Chuoi dai nhat: duyet cac ngay theo thu tu tang dan va dem cac doan lien tiep
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;

  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00`);
    if (previous && Math.round((date.getTime() - previous.getTime()) / DAY_MS) === 1) run += 1;
    else run = 1;

    longest = Math.max(longest, run);
    previous = date;
  }

  return { current, longest, listenedToday };
}
