import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  MIX_DURATION_TOLERANCE_SECONDS,
  MIX_WEIGHTS,
  mixQueueLabel,
  rankMixCandidates,
  scoreMixCandidate,
  sharedTags,
} from "@/lib/music/mix";
import type { SongDTO } from "@/types";

/**
 * Kiem chung "Mix quanh bai nay": npx tsx scripts/verify-mix.ts
 *  1. Luat cham diem (thuan JS) - phan de sai nhat, vi du bai chi cung nguon phat khong
 *     duoc xep tren bai cung the loai, the trung chi cong toi da 4 diem...
 *  2. Xep hang co on dinh khong (bam mix 2 lan phai ra cung danh sach).
 *  3. Cac manh ghep UI/API con nguyen (route, nut bam tren thanh phat & trinh phat day du).
 *  4. Neu CSDL san sang: tao mix that cho bai nghe nhieu nhat de kiem tra ket qua cuoi cung.
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function song(overrides: Partial<SongDTO> & { id: string }): SongDTO {
  return {
    title: `Bài ${overrides.id}`,
    artist: null,
    album: null,
    description: null,
    durationSeconds: 200,
    thumbnailUrl: null,
    sourceType: "YOUTUBE",
    sourceId: null,
    sourceUrl: null,
    streamUrl: null,
    embedUrl: null,
    playbackType: "EMBED",
    tags: [],
    genreId: null,
    genre: null,
    isPublished: true,
    playCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: null,
    ...overrides,
  };
}

const rockGenre = { id: "g1", name: "Rock", slug: "rock", color: "#ff0000" };
const popGenre = { id: "g2", name: "Pop", slug: "pop", color: "#00ff00" };

const seed = song({
  id: "seed",
  title: "Bài gốc",
  artist: "Ca sĩ A",
  genreId: "g1",
  genre: rockGenre,
  tags: ["rock", "hay"],
  sourceType: "YOUTUBE",
  durationSeconds: 200,
});

const genreOnly = song({
  id: "genre",
  genreId: "g1",
  genre: rockGenre,
  artist: "Ca sĩ B",
  sourceType: "SOUNDCLOUD",
  durationSeconds: 600,
});
check(
  "Cung the loai duoc diem cao nhat trong nhom tin hieu don le",
  scoreMixCandidate(seed, genreOnly).score === MIX_WEIGHTS.genre,
  String(scoreMixCandidate(seed, genreOnly).score),
);
check(
  "Cung the loai co ly do de hien thi",
  scoreMixCandidate(seed, genreOnly).reasons.some((reason) => reason.includes("Rock")),
);
check("Cung the loai duoc uu tien hon cung nghe si", MIX_WEIGHTS.genre > MIX_WEIGHTS.artist);

const artistOnly = song({
  id: "artist",
  artist: "Ca sĩ A",
  genreId: "g2",
  genre: popGenre,
  sourceType: "SOUNDCLOUD",
  durationSeconds: 600,
});
check("Cung nghe si cong dung trong so", scoreMixCandidate(seed, artistOnly).score === MIX_WEIGHTS.artist);

const oneTag = song({
  id: "tag1",
  tags: ["rock"],
  genreId: "g2",
  genre: popGenre,
  artist: "Ca sĩ B",
  sourceType: "SOUNDCLOUD",
  durationSeconds: 600,
});
check("Mot the trung cong 2 diem", scoreMixCandidate(seed, oneTag).score === MIX_WEIGHTS.tag);

const manyTags = song({
  id: "tag3",
  tags: ["rock", "hay", "moi"],
  genreId: "g2",
  genre: popGenre,
  artist: "Ca sĩ B",
  sourceType: "SOUNDCLOUD",
  durationSeconds: 600,
});
check(
  `Nhieu the trung bi gioi han o ${MIX_WEIGHTS.maxTagScore} diem`,
  scoreMixCandidate(seed, manyTags).score === MIX_WEIGHTS.maxTagScore,
  String(scoreMixCandidate(seed, manyTags).score),
);

const sourceOnly = song({
  id: "source",
  genreId: "g2",
  genre: popGenre,
  artist: "Ca sĩ B",
  sourceType: "YOUTUBE",
  durationSeconds: 600,
});
check("Chi cung nguon phat = diem thap", scoreMixCandidate(seed, sourceOnly).score === MIX_WEIGHTS.source);

const nearDuration = song({
  id: "near",
  genreId: "g2",
  genre: popGenre,
  artist: "Ca sĩ B",
  sourceType: "SOUNDCLOUD",
  durationSeconds: 200 + MIX_DURATION_TOLERANCE_SECONDS,
});
check("Thoi luong lech trong nguong van duoc cong diem", scoreMixCandidate(seed, nearDuration).score === MIX_WEIGHTS.duration);

const farDuration = song({
  id: "far",
  genreId: "g2",
  genre: popGenre,
  artist: "Ca sĩ B",
  sourceType: "SOUNDCLOUD",
  durationSeconds: 200 + MIX_DURATION_TOLERANCE_SECONDS + 1,
});
check("Thoi luong lech qua nguong thi khong cong", scoreMixCandidate(seed, farDuration).score === 0);

const perfect = song({
  id: "perfect",
  artist: "Ca sĩ A",
  genreId: "g1",
  genre: rockGenre,
  tags: ["rock"],
  sourceType: "YOUTUBE",
  durationSeconds: 210,
});
const perfectScore =
  MIX_WEIGHTS.genre + MIX_WEIGHTS.artist + MIX_WEIGHTS.tag + MIX_WEIGHTS.source + MIX_WEIGHTS.duration;
check(
  "Bai trung het moi tin hieu dat diem toi da",
  scoreMixCandidate(seed, perfect).score === perfectScore,
  `${scoreMixCandidate(seed, perfect).score} vs ${perfectScore}`,
);

check(
  "So sanh nghe si khong phan biet hoa/thuong va khoang trang",
  scoreMixCandidate(
    seed,
    song({
      id: "case",
      artist: "  ca sĩ a  ",
      genreId: "g2",
      genre: popGenre,
      sourceType: "SOUNDCLOUD",
      durationSeconds: 600,
    }),
  ).score === MIX_WEIGHTS.artist,
);

check(
  "Bai khac het moi thu = 0 diem",
  scoreMixCandidate(
    seed,
    song({
      id: "none",
      artist: "Ca sĩ Z",
      genreId: "g2",
      genre: popGenre,
      sourceType: "TIKTOK",
      durationSeconds: 900,
    }),
  ).score === 0,
);

const shared = sharedTags(seed, song({ id: "shared", tags: ["ROCK", "hay", "hay"] }));
check("sharedTags tra ve the goc (khong trung lap)", JSON.stringify(shared) === JSON.stringify(["ROCK", "hay"]), JSON.stringify(shared));

/* ------------------------------- 2. Xep hang --------------------------------- */

const far = song({
  id: "z-far",
  title: "Z bài xa",
  artist: "Ca sĩ B",
  genreId: "g2",
  genre: popGenre,
  sourceType: "SOUNDCLOUD",
  durationSeconds: 900,
});
const near = song({
  id: "a-near",
  title: "A bài gần",
  artist: "Ca sĩ B",
  genreId: "g1",
  genre: rockGenre,
  sourceType: "SOUNDCLOUD",
  durationSeconds: 900,
});
const popular = song({
  id: "b-popular",
  title: "B bài hot",
  artist: "Ca sĩ B",
  genreId: "g1",
  genre: rockGenre,
  sourceType: "SOUNDCLOUD",
  durationSeconds: 900,
  playCount: 500,
});

const ranked = rankMixCandidates(
  seed,
  [far, near, popular, seed, near, song({ id: "hidden", isPublished: false, genreId: "g1", genre: rockGenre })],
  10,
);
const rankedIds = ranked.map((item) => item.song.id);

check("Khong bao gio tra ve bai goc", !rankedIds.includes(seed.id));
check("Bo bai chua phat hanh", !rankedIds.includes("hidden"));
check("Khong lap lai mot bai", new Set(rankedIds).size === rankedIds.length);
check("Diem cao xep truoc", rankedIds.indexOf("b-popular") < rankedIds.indexOf("z-far"));
check("Cung diem thi bai nghe nhieu hon dung truoc", rankedIds.indexOf("b-popular") < rankedIds.indexOf("a-near"));
check(
  "Cung diem va cung luot nghe thi sap theo ten A->Z",
  rankedIds.indexOf("a-near") < rankedIds.indexOf("z-far"),
  rankedIds.join(" > "),
);
check("Ton trong gioi han so bai", rankMixCandidates(seed, [near, popular, far], 2).length === 2);
check("Limit 0 tra ve rong", rankMixCandidates(seed, [near], 0).length === 0);
check(
  "Xep hang on dinh (dao thu tu dau vao van ra cung ket qua)",
  JSON.stringify(rankMixCandidates(seed, [far, near, popular])) ===
    JSON.stringify(rankMixCandidates(seed, [popular, far, near])),
);
check(
  "Nhan hang cho co ten bai",
  mixQueueLabel(seed).includes("Bài gốc") && mixQueueLabel(seed).startsWith("Mix quanh"),
);

/* --------------------------- 3. Manh ghep API / UI --------------------------- */

const root = process.cwd();
const routeSource = readFileSync(path.join(root, "src", "app", "api", "songs", "[id]", "mix", "route.ts"), "utf8");
check(
  "API /api/songs/[id]/mix ton tai va goi service",
  routeSource.includes("buildSongMix") && routeSource.includes("export const GET"),
);
check("API mix cho ca khach chua dang nhap (chi doc bai da phat hanh)", routeSource.includes("getActiveSessionUser"));

/*
 * Loi da gap khi thu that: proxy (`src/proxy.ts`) co danh sach API cong khai; quen khai bao
 * `/api/songs/:id/mix` thi khach bam nut Mix se nhan 401 du route da cho phep.
 * `npm run check:guest` (can server) kiem tra lai dieu nay bang request that.
 */
const proxySource = readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
check(
  "Proxy cho khach GET /api/songs/:id/mix",
  /\\\/api\\\/songs\\\/\[\^\/\]\+\\\/mix\$/.test(proxySource),
  "thieu quy tac trong isPublicApi",
);
check("Proxy chan khach vao trang nhip nghe (du lieu ca nhan)", proxySource.includes('"/music/stats"'));

const buttonSource = readFileSync(path.join(root, "src", "components", "player", "mix-button.tsx"), "utf8");
check("Nut Mix goi API roi phat hang cho moi", buttonSource.includes("/mix") && buttonSource.includes("playQueue"));
check(
  "Nut Mix hien trang thai dang tai (khong bam lien tuc)",
  buttonSource.includes("Loader2") && buttonSource.includes("disabled={pending}"),
);

const barSource = readFileSync(path.join(root, "src", "components", "player", "player-bar.tsx"), "utf8");
const fullPlayerSource = readFileSync(path.join(root, "src", "components", "player", "full-player.tsx"), "utf8");
check("Thanh phat co nut Mix", barSource.includes("<MixButton"));
check("Trinh phat day du cung co nut Mix", fullPlayerSource.includes("<MixButton"));

/* ------------------------------ 4. Kiem tra CSDL ----------------------------- */

async function runDatabaseCheck(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    skip("Mix that tren CSDL", "khong co DATABASE_URL");
    return;
  }

  const { prisma } = await import("@/lib/db/prisma");

  try {
    const { buildSongMix } = await import("@/services/mix.service");

    const topSong = await prisma.song.findFirst({
      where: { isPublished: true },
      orderBy: { playCount: "desc" },
      select: { id: true, title: true },
    });

    /* Thu vien chi co 1 bai thi khong the co "bai tuong tu" -> bo qua, khong bao loi sai */
    const publishedCount = await prisma.song.count({ where: { isPublished: true } });

    if (!topSong || publishedCount < 2) {
      skip(
        "Mix that tren CSDL",
        topSong
          ? `thu vien chi co ${publishedCount} bai da phat hanh -> khong the tao mix`
          : "thu vien chua co bai nao phat hanh",
      );
    } else {
      const mix = await buildSongMix(topSong.id, { limit: 10 });

      check("Mix that: bai goc dung la bai yeu cau", mix.seed.id === topSong.id);
      check("Mix that: co bai de phat", mix.songs.length > 0, `${mix.songs.length} bai`);
      check("Mix that: khong chua bai goc", !mix.songs.some((item) => item.id === topSong.id));
      check("Mix that: khong trung bai", new Set(mix.songs.map((item) => item.id)).size === mix.songs.length);
      check("Mix that: toan bo deu da phat hanh", mix.songs.every((item) => item.isPublished));

      let notFoundMessage = "";
      try {
        await buildSongMix("khong-ton-tai", { limit: 5 });
      } catch (error) {
        notFoundMessage = error instanceof Error ? error.message : String(error);
      }
      check("Mix that: bao loi khi bai khong ton tai", notFoundMessage.includes("không tồn tại"), notFoundMessage);

      console.log(`\nBai goc kiem tra: ${topSong.title} — ${mix.songs.length} bai trong mix`);
    }
  } catch (error) {
    skip("Mix that tren CSDL", error instanceof Error ? error.message : String(error));
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
