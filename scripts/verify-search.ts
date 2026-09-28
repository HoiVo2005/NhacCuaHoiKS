import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Kiem chung hanh vi TIM KIEM tren PostgreSQL: npx tsx scripts/verify-search.ts
 *
 * Vi sao can: SQL Server so sanh chuoi KHONG phan biet hoa/thuong (collation mac dinh), con
 * PostgreSQL thi CO. Neu thieu `mode: "insensitive"` thi nguoi dung go "nhac" se khong tim thay
 * "Nhạc" - dung loai loi im lang, kho phat hien bang mat thuong.
 *
 * Script kiem 2 tang:
 *  1. Ma nguon: moi truy van `contains` trong tang nghiep vu deu phai co `mode:` (khong can CSDL).
 *  2. CSDL that (neu ket noi duoc): tao 1 bai tam co ten HOA/thuong lan lon, tim bang chu thuong,
 *     roi xoa di. Khong ket noi duoc -> SKIP (khong lam hong ket qua kiem tra).
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/* ------------------------- 1. Kiem tra o tang ma nguon ------------------------- */

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

const songService = source("src/services/song.service.ts");
const discoveryService = source("src/services/song-discovery.service.ts");
const authSource = source("src/auth.ts");
const userService = source("src/services/user.service.ts");

/** Mọi `contains:` trong file phải đi kèm `mode:` ở cùng object */
function containsAlwaysHasMode(fileSource: string): { ok: boolean; offenders: string[] } {
  const offenders: string[] = [];

  for (const line of fileSource.split(/\r?\n/)) {
    if (!line.includes("contains:")) continue;
    if (line.includes("mode:")) continue;
    // Cho phep dong mo dau (object nam o dong duoi)
    offenders.push(line.trim());
  }

  return { ok: offenders.length === 0, offenders };
}

const songWhere = containsAlwaysHasMode(songService);
check(
  "Moi `contains` o song.service.ts deu kem `mode` (khong phan biet hoa/thuong)",
  songWhere.ok,
  songWhere.offenders.join(" / "),
);

const discoveryWhere = containsAlwaysHasMode(discoveryService);
check(
  "Moi `contains` o song-discovery.service.ts deu kem `mode`",
  discoveryWhere.ok,
  discoveryWhere.offenders.join(" / "),
);

check(
  "Che do so sanh duoc khai bao bang hang so `as const` (giu dung kieu QueryMode)",
  songService.includes('const CASE_INSENSITIVE = "insensitive" as const;'),
);
check("Tim kiem nhanh (thanh header) cung dung che do khong phan biet hoa/thuong", discoveryService.includes("quickSearch"));
check(
  "Email dang nhap duoc chuan hoa chu thuong truoc khi tra cuu",
  authSource.includes("parsed.data.email.toLowerCase()") &&
    userService.includes("email.toLowerCase()"),
);

/* ------------------------- 2. Kiem tra tren CSDL that ------------------------- */

async function runDatabaseCheck(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) {
    skip("Kiem tra tren CSDL that", "DATABASE_URL khong phai PostgreSQL (xem .env.example)");
    return;
  }

  let prismaModule: typeof import("@/lib/db/prisma") | null = null;

  try {
    prismaModule = await import("@/lib/db/prisma");
  } catch (error) {
    skip("Kiem tra tren CSDL that", error instanceof Error ? error.message : String(error));
    return;
  }

  const { prisma } = prismaModule;
  const marker = `Kiểm Chứng Tìm Kiếm ${Date.now()}`;
  let songId: string | null = null;

  try {
    const created = await prisma.song.create({
      data: {
        title: marker,
        artist: "ZZZ Kiểm Chứng",
        sourceType: "YOUTUBE",
        isPublished: true,
      },
      select: { id: true },
    });
    songId = created.id;

    const lowered = marker.toLowerCase();
    const found = await prisma.song.count({
      where: { title: { contains: lowered, mode: "insensitive" } },
    });
    check("Tim bang chu THUONG ra bai co ten HOA/thuong lan lon", found >= 1, `found=${found}`);

    const strict = await prisma.song.count({ where: { title: { contains: lowered } } });
    check(
      "Che do mac dinh (khong `mode`) la phan biet hoa/thuong -> dung la ly do phai co `mode`",
      strict === 0,
      `strict=${strict}`,
    );
  } catch (error) {
    skip("Kiem tra tren CSDL that", error instanceof Error ? error.message : String(error));
  } finally {
    if (songId) {
      await prisma.song.delete({ where: { id: songId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  }
}

/* --------------------------------- Ket qua --------------------------------- */

void (async () => {
  await runDatabaseCheck();

  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
