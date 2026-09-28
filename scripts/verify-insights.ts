import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildDailyTrend,
  buildHourBuckets,
  buildStreak,
  localDayKey,
  peakHourBucket,
  startOfLocalDay,
} from "@/lib/listening-insights";

/**
 * Kiem chung "Nhip nghe" (thong ke ca nhan): npx tsx scripts/verify-insights.ts
 *  1. Cac phep tinh theo NGAY DIA PHUONG (bieu do ngay, chuoi ngay lien tiep, khung gio).
 *  2. Trang /music/stats + service + muc menu con nguyen.
 *  3. Neu CSDL san sang: chay thong ke that cho mot nguoi dung de kiem tra hinh dang du lieu.
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/** Moc thoi gian theo GIO DIA PHUONG de test on dinh (khong phu thuoc mui gio may chay) */
function at(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const now = at(2026, 9, 28, 20); // 28/09/2026 20:00 gio dia phuong

/* ---------------------------------- 1. Ngay ---------------------------------- */

check("Khoa ngay theo gio dia phuong dung dinh dang yyyy-mm-dd", localDayKey(at(2026, 1, 5)) === "2026-01-05");
check("Khoa ngay dem du 0 (khong bi thieu)", localDayKey(at(2026, 9, 9)) === "2026-09-09");
check(
  "startOfLocalDay xoa gio/phut/giay",
  startOfLocalDay(at(2026, 9, 28, 20, 45)).getHours() === 0 &&
    startOfLocalDay(at(2026, 9, 28, 20, 45)).getMinutes() === 0,
);

const trend = buildDailyTrend([at(2026, 9, 28, 9), at(2026, 9, 28, 21), at(2026, 9, 26, 8), at(2026, 8, 1, 8)], 30, now);
check("Bieu do tra ve dung so ngay yeu cau", trend.length === 30, String(trend.length));
check("Ngay cuoi cung cua bieu do la hom nay", trend[trend.length - 1].date === "2026-09-28");
check("Dem dung so luot trong ngay", trend[trend.length - 1].plays === 2, String(trend[trend.length - 1].plays));
check("Ngay khong nghe = 0 (khong bo trong bieu do)", trend[trend.length - 2].plays === 0);
check("Luot nghe cu hon cua so khong lam sai bieu do", trend.every((day) => day.plays <= 2));
check(
  "Bieu do 1 ngay van tra ve 1 moc",
  buildDailyTrend([at(2026, 9, 28, 9)], 1, now).length === 1,
);

/* --------------------------------- 2. Khung gio -------------------------------- */

const buckets = buildHourBuckets([at(2026, 9, 28, 0, 5), at(2026, 9, 28, 2, 59), at(2026, 9, 28, 23, 30)], 3);
check("So khung gio = 8 (3 gio/khung)", buckets.length === 8, String(buckets.length));
check("Nhan khung gio dau tien", buckets[0].label === "0h–2h", buckets[0].label);
check("Nhan khung gio cuoi cung", buckets[7].label === "21h–23h", buckets[7].label);
check("Gio 0 va gio 2 cung khung dau", buckets[0].plays === 2, String(buckets[0].plays));
check("Gio 23 roi vao khung cuoi", buckets[7].plays === 1);
check("Khung gio khong nghe = 0", buckets[3].plays === 0);
check("Tong luot nghe duoc giu nguyen sau khi gom khung", buckets.reduce((sum, bucket) => sum + bucket.plays, 0) === 3);
check("peakHourBucket = null khi chua nghe gi", peakHourBucket(buildHourBuckets([], 3)) === null);
check("peakHourBucket tra ve khung nhieu nhat", peakHourBucket(buckets)?.label === "0h–2h");
check(
  "peakHourBucket bo qua khung 0 luot",
  peakHourBucket(buildHourBuckets([at(2026, 9, 28, 10)], 3))?.label === "9h–11h",
);

/* ------------------------------ 3. Chuoi ngay -------------------------------- */

const emptyStreak = buildStreak([], now);
check("Chua nghe bao gio -> chuoi 0", emptyStreak.current === 0 && emptyStreak.longest === 0 && !emptyStreak.listenedToday);

const todayOnly = buildStreak([at(2026, 9, 28, 9)], now);
check("Chi nghe hom nay -> chuoi 1 va bao da nghe hom nay", todayOnly.current === 1 && todayOnly.listenedToday);

const threeDays = buildStreak([at(2026, 9, 28, 9), at(2026, 9, 27, 9), at(2026, 9, 26, 9)], now);
check("Ba ngay lien tiep -> chuoi 3", threeDays.current === 3 && threeDays.longest === 3, `${threeDays.current}/${threeDays.longest}`);
check("Nhieu luot trong cung mot ngay chi tinh mot ngay", buildStreak([at(2026, 9, 28, 8), at(2026, 9, 28, 9), at(2026, 9, 28, 10)], now).current === 1);

const keptByYesterday = buildStreak([at(2026, 9, 27, 9), at(2026, 9, 26, 9)], now);
check(
  "Hom nay chua nghe thi chuoi van tinh tới hom qua (chua mat chuoi)",
  keptByYesterday.current === 2 && !keptByYesterday.listenedToday,
  String(keptByYesterday.current),
);

const gapStreak = buildStreak([at(2026, 9, 28, 9), at(2026, 9, 27, 9), at(2026, 9, 22, 9)], now);
check("Ngay bi ngat thi chuoi hien tai dung lai", gapStreak.current === 2, String(gapStreak.current));

const oldRun = buildStreak(
  [at(2026, 9, 28, 9), at(2026, 9, 10, 9), at(2026, 9, 11, 9), at(2026, 9, 12, 9), at(2026, 9, 13, 9)],
  now,
);
check("Ky luc chuoi tinh ca doan cu", oldRun.current === 1 && oldRun.longest === 4, `${oldRun.current}/${oldRun.longest}`);

const yesterdayRun = buildStreak([at(2026, 9, 27, 9), at(2026, 9, 26, 9), at(2026, 9, 25, 9)], now);
check("Hom qua van con chuoi 3 ngay", yesterdayRun.current === 3);
check("Chuoi tinh theo ngay dia phuong (23:59 va 00:01 khac ngay)", buildStreak([at(2026, 9, 28, 23, 59), at(2026, 9, 28, 0, 1)], now).current === 1);

/* --------------------------- 4. Service + trang + menu ------------------------ */

const root = process.cwd();
const serviceSource = readFileSync(path.join(root, "src", "services", "history.service.ts"), "utf8");
check(
  "Service co ham thong ke nhip nghe",
  serviceSource.includes("export async function getListeningInsights") &&
    serviceSource.includes("INSIGHTS_WINDOW_DAYS") &&
    serviceSource.includes("INSIGHTS_TREND_DAYS"),
);
check(
  "Service tai dung cac ham tinh toan thuan (khong viet lai logic ngay/gio)",
  ["buildDailyTrend", "buildHourBuckets", "buildStreak", "peakHourBucket"].every((name) =>
    serviceSource.includes(name),
  ),
);

const pageSource = readFileSync(path.join(root, "src", "app", "music", "stats", "page.tsx"), "utf8");
check("Trang /music/stats chi hien cho nguoi da dang nhap", pageSource.includes("requireUserPage"));
check("Trang dung lai bo component thiet ke chung", ["StatGrid", "PanelHeader", "PlaysLineChart", "RankedList", "SourceBreakdown", "HorizontalBars"].every((name) => pageSource.includes(name)));
check("Trang co trang thai rong cho nguoi chua nghe bai nao", pageSource.includes("<EmptyState"));
check("Trang cho phep phat lai top bai cua nguoi dung", pageSource.includes("<SongList"));

const navSource = readFileSync(path.join(root, "src", "lib", "nav.ts"), "utf8");
check("Menu nhan vien co muc Nhip nghe", navSource.includes('href: "/music/stats"') && navSource.includes("Nhịp nghe"));

/* ------------------------------ 5. Kiem tra CSDL ----------------------------- */

async function runDatabaseCheck(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    skip("Thong ke that tren CSDL", "khong co DATABASE_URL");
    return;
  }

  const { prisma } = await import("@/lib/db/prisma");

  try {
    const { getListeningInsights, INSIGHTS_TREND_DAYS } = await import("@/services/history.service");

    const anyUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

    if (!anyUser) {
      skip("Thong ke that tren CSDL", "chua co nguoi dung nao");
    } else {
      const insights = await getListeningInsights(anyUser.id);

      check("Thong ke that: bieu do dung so ngay", insights.dailyTrend.length === INSIGHTS_TREND_DAYS);
      check("Thong ke that: du 8 khung gio", insights.hourBuckets.length === 8);
      check("Thong ke that: nguon phat du 4 loai", insights.bySource.length === 4);
      check("Thong ke that: tong luot nghe khong am", insights.totalPlays >= 0 && insights.totalMsPlayed >= 0);
      check(
        "Thong ke that: top bai khong vuot qua so luot nghe",
        insights.topSongs.every((entry) => entry.plays > 0 && entry.plays <= insights.totalPlays),
      );
      check(
        "Thong ke that: chuoi ngay khong am va khong vuot so ngay co du lieu",
        insights.streak.current >= 0 && insights.streak.longest >= insights.streak.current,
      );

      // Nguoi dung khong ton tai: cau truy van tra ve rong chu khong nem loi
      const ghost = await getListeningInsights("khong-ton-tai");
      check(
        "Thong ke nguoi dung khong ton tai: tra ve rong, khong loi",
        ghost.totalPlays === 0 && ghost.topSongs.length === 0 && ghost.streak.current === 0,
      );

      console.log(`\nNguoi dung kiem tra: ${anyUser.name} — ${insights.totalPlays} luot nghe`);
    }
  } catch (error) {
    skip("Thong ke that tren CSDL", error instanceof Error ? error.message : String(error));
  } finally {
    /* Dong pool SQL Server: khong dong thi tien trinh Node khong tu thoat (script bi treo) */
    await prisma.$disconnect().catch(() => undefined);
  }
}

/** In ket qua va dat ma thoat (chay sau khi phan kiem tra CSDL xong) */
function report(): void {
  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void runDatabaseCheck().finally(report);
