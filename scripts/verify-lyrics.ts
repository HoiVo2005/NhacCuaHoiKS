import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import {
  findActiveLyricIndex,
  formatLyricTimestamp,
  looksSynced,
  LYRIC_MAX_OFFSET_MS,
  LYRIC_OFFSET_STEP_MS,
  lyricsToPlainText,
  normalizePlainLyrics,
  parseLrc,
  parseLyricsInput,
} from "@/lib/music/lyrics";
import { AUTO_LYRICS_MAX_DURATION_SECONDS, autoLyricsSkipReason, isOrdinarySong } from "@/lib/music/lyrics-auto";
import {
  artistMatchScore,
  durationMatches,
  evaluateLyricsCandidate,
  MATCH_RULES,
  storedMatchConfidence,
  titleMatchScore,
} from "@/lib/music/lyrics-match";
import { PLAYER_SHORTCUTS } from "@/lib/player-shortcuts";
import { clearSongLyrics, countSongsMissingLyrics, getSongLyrics, isCacheReusable, listSongIdsMissingLyrics, lookupLyrics, saveManualLyrics, stripTitleNoise, titleCandidates, warmLyricsCache } from "@/services/lyrics.service";

/**
 * Kiem chung "Loi bai hat (karaoke)": npx tsx scripts/verify-lyrics.ts
 *  1. Doc file LRC (nhieu moc tren mot dong, offset, tag meta, thieu phan tram giay...).
 *  2. Tim dong dang hat (truoc dong dau tien phai la -1, dung dong khi trung moc).
 *  3. Chinh sach cache (co noi dung thi dung lai; khong tim thay thi cho vai ngay moi thu lai).
 *  4. Cac manh ghep: service, API, proxy, UI, phim tat.
 *  5. CSDL that: dan loi tay -> doc lai tu cache (khong goi mang) -> xoa cache (khoi phuc du lieu cu).
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const SAMPLE_LRC = [
  "[ti:Bài mẫu]",
  "[ar:Ca sĩ mẫu]",
  "[offset:-500]",
  "[00:12.00]Dòng thứ nhất",
  "[00:16.50][00:55.00]Điệp khúc",
  "[00:20]Dòng thiếu phần trăm giây",
  "[00:25:25]Dòng dùng dấu hai chấm cho phần trăm giây",
].join("\r\n");

const parsed = parseLrc(SAMPLE_LRC);

check("Doc duoc tag meta ten bai", parsed.meta.title === "Bài mẫu", String(parsed.meta.title));
check("Doc duoc tag meta nghe si", parsed.meta.artist === "Ca sĩ mẫu", String(parsed.meta.artist));
check("Doc duoc the offset (am = loi chay som hon)", parsed.offsetMs === -500, String(parsed.offsetMs));
check("Bo qua dong trong va dong chi co moc", parseLrc("[00:05.00]\n\n[00:06.00]A").lines.length === 1);
check("Mot dong nhieu moc -> nhieu dong loi", parsed.lines.filter((line) => line.text === "Điệp khúc").length === 2);
check(
  "Dong co moc [mm:ss] (khong phan tram giay) van doc duoc",
  parsed.lines.some((line) => line.timeMs === 20_000 && line.text === "Dòng thiếu phần trăm giây"),
);
check(
  "Moc dang [mm:ss:xx] cung duoc hieu la phan tram giay",
  parsed.lines.some((line) => line.timeMs === 25_250),
  JSON.stringify(parsed.lines.map((line) => line.timeMs)),
);
check("Sap xep lai theo thoi gian", parsed.lines.every((line, index) => index === 0 || line.timeMs >= parsed.lines[index - 1].timeMs));
check("Moc thoi gian duoc doi dung sang ms", parsed.lines[0].timeMs === 12_000, String(parsed.lines[0].timeMs));
check("Dong khong co moc thoi gian bi bo qua", parseLrc("Day chi la loi thuong\nKhong co moc").lines.length === 0);
check("Chuoi rong tra ve rong, khong loi", parseLrc("").lines.length === 0 && parseLrc("").offsetMs === 0);
check("Luot bo \r\n (file LRC luu kieu Windows)", parsed.lines.length === 5, String(parsed.lines.length));
check("looksSynced nhan dien loi karaoke", looksSynced(SAMPLE_LRC) && !looksSynced("Lời thường\nkhông có mốc"));
check(
  "Doi nguoc dong loi thanh van ban thuong",
  lyricsToPlainText([{ timeMs: 1, text: "A" }, { timeMs: 2, text: "B" }]) === "A\nB",
);
check("formatLyricTimestamp dung dinh dang mm:ss.cc", formatLyricTimestamp(123_456) === "02:03.45", formatLyricTimestamp(123_456));
check("formatLyricTimestamp khong tra ve so am", formatLyricTimestamp(-10) === "00:00.00");
check("normalizePlainLyrics gon dong trong thua", normalizePlainLyrics("A\n\n\n\nB\n") === "A\n\nB", JSON.stringify(normalizePlainLyrics("A\n\n\n\nB\n")));

const plainInput = parseLyricsInput("Lời thường\ncó hai dòng");
check("Loi dan tay khong co moc -> che do loi thuong", !plainInput.synced && plainInput.lines.length === 0 && plainInput.plain.length > 0);

const syncedInput = parseLyricsInput("[00:01.00]A\n[00:03.00]B");
check("Loi dan tay co moc -> che do karaoke", syncedInput.synced && syncedInput.lines.length === 2);
check("Loi dan tay rong -> khong co gi de luu", parseLyricsInput("   ").plain === "" && parseLyricsInput("   ").lines.length === 0);
check("Buoc chinh lech va gioi han chinh lech hop ly", LYRIC_OFFSET_STEP_MS === 500 && LYRIC_MAX_OFFSET_MS === 10_000);

/* ---------------------------- Dong dang hat ---------------------------------- */

const lineList = [
  { timeMs: 1000, text: "A" },
  { timeMs: 5000, text: "B" },
  { timeMs: 5000, text: "B (diep khuc)" },
  { timeMs: 9000, text: "C" },
];

check("Chua toi dong dau tien -> khong to dong nao (-1)", findActiveLyricIndex(lineList, 0) === -1);
check("Dung moc dong dau tien -> to dong 0", findActiveLyricIndex(lineList, 1000) === 0);
check("Giua hai dong -> to dong truoc do", findActiveLyricIndex(lineList, 4000) === 0);
check("Trung moc -> to dong cuoi cung co moc do (diep khuc)", findActiveLyricIndex(lineList, 5000) === 2);
check("Sau dong cuoi -> to dong cuoi", findActiveLyricIndex(lineList, 99_999) === 3);
check("Danh sach rong -> -1", findActiveLyricIndex([], 5000) === -1);
check("Vi tri khong hop le -> -1", findActiveLyricIndex(lineList, Number.NaN) === -1);

const manyLines = Array.from({ length: 2000 }, (_, index) => ({ timeMs: index * 1000, text: `Dòng ${index}` }));
check(
  "Tim dong dung trong danh sach dai (2000 dong)",
  findActiveLyricIndex(manyLines, 1_500_500) === 1500,
  String(findActiveLyricIndex(manyLines, 1_500_500)),
);

/* ------------------------------- Chinh sach cache ---------------------------- */

const now = new Date("2026-09-28T12:00:00.000Z");
const baseRow = {
  songId: "song-1",
  syncedLyrics: "[00:01.00]A",
  plainLyrics: "A",
  source: "LRCLIB",
  matchedTrack: "A",
  matchedArtist: "B",
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

check("Cache co loi -> dung lai vinh vien", isCacheReusable(baseRow, now));
check(
  "Lan truoc khong tim thay -> cho phep tra cuu lai sau vai ngay",
  !isCacheReusable({ ...baseRow, syncedLyrics: null, plainLyrics: null, updatedAt: new Date("2026-09-01T00:00:00.000Z") }, now),
);
check(
  "Lan truoc khong tim thay nhung moi thu lai gan day -> chua tra cuu lai (do tan suat API)",
  isCacheReusable({ ...baseRow, syncedLyrics: null, plainLyrics: null, updatedAt: new Date("2026-09-27T00:00:00.000Z") }, now),
);
check(
  "Loi do quan tri vien dan (ke ca trong) luon duoc ton trong",
  isCacheReusable({ ...baseRow, syncedLyrics: null, plainLyrics: null, source: "MANUAL", updatedAt: new Date("2020-01-01T00:00:00.000Z") }, now),
);

/* --------------------------- Lam sach ten bai khi tra cuu ------------------- */

check(
  "Bo (Official Video)/(Lyric Video)/- Topic khi tra cuu",
  stripTitleNoise("Bài hay (Official Video) - Topic") === "Bài hay",
  stripTitleNoise("Bài hay (Official Video) - Topic"),
);
check(
  "Giu phan trong ngoac KHONG phai tu khoa nhieu (vi du ten ban Remix)",
  stripTitleNoise("Bài hay (Lofi Chill)").includes("Lofi Chill"),
  stripTitleNoise("Bài hay (Lofi Chill)"),
);
check(
  "Bo ten kenh kieu YouTube nhung GIU doan that su la ten bai",
  stripTitleNoise("LK Qua Đêm Nay - Quốc Thiên | Official Music Video | Mây Saigon") ===
    "LK Qua Đêm Nay - Quốc Thiên | Mây Saigon",
  stripTitleNoise("LK Qua Đêm Nay - Quốc Thiên | Official Music Video | Mây Saigon"),
);
check(
  "Bo doan nhieu cuoi cung va don sach dau | thua",
  stripTitleNoise("Bài hay | Official Audio") === "Bài hay",
  stripTitleNoise("Bài hay | Official Audio"),
);
check(
  "Ten that su co dau | (khong phai ten kenh) thi giu nguyen",
  stripTitleNoise("Yêu | Em") === "Yêu | Em",
  stripTitleNoise("Yêu | Em"),
);
check(
  "GIU cac ban khac ve loi: Remix / Live / Karaoke",
  stripTitleNoise("Bài hay (Remix)").includes("Remix") && stripTitleNoise("Bài hay (Live)").includes("Live"),
  stripTitleNoise("Bài hay (Remix)"),
);
const candidates = titleCandidates("Bài hay (Official MV)");
check(
  "Thu ca ten sach lan ten goc khi tra cuu",
  candidates.length === 2 && candidates[0] === "Bài hay" && candidates[1] === "Bài hay (Official MV)",
  JSON.stringify(candidates),
);
check("Ten bai sach thi chi co mot ung vien", titleCandidates("Bài hay").length === 1);

const libraryCandidates = titleCandidates(
  "LK Qua Đêm Nay - Quốc Thiên | Official Music Video | Mây Saigon",
);
check(
  "Ten kieu YouTube: thu tu tu chinh xac den rong (co ca ban rut gon)",
  libraryCandidates[0] === "LK Qua Đêm Nay - Quốc Thiên | Mây Saigon" &&
    libraryCandidates.includes("LK Qua Đêm Nay - Quốc Thiên | Official Music Video | Mây Saigon") &&
    libraryCandidates[libraryCandidates.length - 1] === "LK Qua Đêm Nay",
  JSON.stringify(libraryCandidates),
);
check(
  "Ten kieu album: tach tung doan sau dau | thanh ung vien rieng",
  titleCandidates("JACK - J97 | LƯU NIÊN | Album TAM THÁI TỬ - Track No.4").includes("LƯU NIÊN"),
);
check(
  "Ten kieu 'TEN BAI | NGHE SI': doan DAU chinh la ten bai (loi da gap that voi 'MẤT BAO LÂU | KHANG VIỆT')",
  titleCandidates("MẤT BAO LÂU | KHANG VIỆT").includes("MẤT BAO LÂU") &&
    titleCandidates("MẤT BAO LÂU | KHANG VIỆT")[0] === "MẤT BAO LÂU | KHANG VIỆT",
);
check(
  "Ban ten da lam sach khong con doan nhieu (ban goc van duoc thu sau)",
  titleCandidates("Bài hay | Official Audio")
    .filter((candidate) => candidate !== "Bài hay | Official Audio")
    .every((candidate) => !candidate.includes("Official")),
);

/* ------------------- KIEM TRA DUNG BAI: khong bao gio hien loi sai ------------------- */

/** Bai mau trong thu vien (ten co ca ten kenh/remix nhu du lieu that) */
const librarySong = {
  title: "Bông Hoa Chẳng Tồn Tại - TN x VietZ Remix",
  artist: "VietZ",
  durationSeconds: 285,
};

check(
  "Trung ca ten bai + nghe si -> duoc chap nhan",
  evaluateLyricsCandidate(
    { title: "Người Phản Bội", artist: "Lê Bảo Bình", durationSeconds: 240 },
    { trackName: "Người Phản Bội", artistName: "Lê Bảo Bình", duration: 238 },
  ).accepted,
);
check(
  "Ban remix/copy dung chung loi: chi can khop TEN BAI la duoc chap nhan",
  evaluateLyricsCandidate(librarySong, {
    trackName: "Bông Hoa Chẳng Tồn Tại - Remix",
    artistName: "NVB Remix",
    duration: 300,
  }).accepted,
);
check(
  "Ten bai co ten kenh / (Official Video) van khop",
  titleMatchScore("LK Qua Đêm Nay - Quốc Thiên | Official Music Video | Mây Saigon", "LK Qua Đêm Nay") >=
    MATCH_RULES.titleMinScore,
);
check(
  "Ten bai khac han -> TU CHOI (khong lay loi sai)",
  evaluateLyricsCandidate(librarySong, {
    trackName: "Lưu Niên",
    artistName: "Jack - J97",
    duration: 242,
  }).reason === "ten-bai-khong-khop",
);
check(
  "Cung nghe si nhung khac bai -> TU CHOI",
  !evaluateLyricsCandidate(
    { title: "Nơi Này Có Anh", artist: "Sơn Tùng M-TP", durationSeconds: 250 },
    { trackName: "Chúng Ta Của Tương Lai", artistName: "Sơn Tùng M-TP", duration: 250 },
  ).accepted,
);
check(
  "Ten bai 1 tu ma khong co tin hieu nao them -> TU CHOI (tranh trung ten)",
  !evaluateLyricsCandidate(
    { title: "Jack", artist: null, durationSeconds: 0 },
    { trackName: "Jack", artistName: "Ai Đó Khác" },
  ).accepted,
);
check(
  "Ten bai 1 tu nhung thoi luong khop -> duoc chap nhan",
  evaluateLyricsCandidate(
    { title: "Jack", artist: null, durationSeconds: 200 },
    { trackName: "Jack", artistName: "Ai Đó", duration: 198 },
  ).accepted,
);
check(
  "So khop khong phan biet dau tieng Viet va hoa/thuong",
  titleMatchScore("Người Phản Bội", "nguoi phan boi") === 1 &&
    titleMatchScore("ANH MỆT RỒI", "Anh Mệt Rồi") === 1,
);
check(
  "Thoi luong lech trong nguong -> khop; lech xa -> khong",
  durationMatches(240, 245) && !durationMatches(240, 400) && !durationMatches(0, 0),
);
check(
  "Ban cover cua nghe si khac: van nhan (khop ten bai) nhung diem nghe si = 0 de UI canh bao",
  (() => {
    const decision = evaluateLyricsCandidate(
      { title: "I Need Your Love Tonight - Thái Hoàng Remix", artist: "Thái Hoàng", durationSeconds: 130 },
      { trackName: "I Need Your Love Tonight", artistName: "Elvis Presley", duration: 120 },
    );
    return decision.accepted && decision.artistScore === 0;
  })(),
);
check(
  "Do tin cay khi hien lai: khop ten + nghe si = exact",
  storedMatchConfidence(
    { title: "Người Phản Bội", artist: "Lê Bảo Bình", durationSeconds: 240 },
    { track: "Người Phản Bội", artist: "Lê Bảo Bình" },
  ) === "exact",
);
check(
  "Do tin cay khi hien lai: chi khop ten = likely (UI phai canh bao)",
  storedMatchConfidence(librarySong, { track: "Bông Hoa Chẳng Tồn Tại", artist: "Ai Đó" }) === "likely",
);
check(
  "Do tin cay khi hien lai: ten khac han = unknown",
  storedMatchConfidence(librarySong, { track: "Một Bài Khác", artist: "Ai Đó" }) === "unknown",
);
check(
  "Diem khop nghe si khong phan biet kenh: 'May Saigon Official' vs 'May Saigon'",
  artistMatchScore("Mây Saigon Official", "Mây Saigon") > 0,
);
check(
  "Nguyen tac chat luong duoc ghi ro trong ma nguon (khong hien loi sai)",
  readFileSync(path.join(process.cwd(), "src", "lib", "music", "lyrics-match.ts"), "utf8").includes(
    "khong lay loi sai",
  ),
);

/* ------------- Chi tu lay loi cho "Bai hat binh thuong" (bo qua LK/mix/tuyen tap) ------------- */

check(
  "Bai hat don binh thuong -> duoc tu tra cuu",
  isOrdinarySong({ title: "Người Phản Bội", durationSeconds: 240 }),
);
check(
  "Ban remix cua MOT bai -> van la bai don (chu 'remix' khong bi hieu nham thanh 'mix')",
  isOrdinarySong({ title: "Người Phản Bội - Lê Bảo Bình x Thái Hoàng Remix", durationSeconds: 60 }),
);
check(
  "Bai nam trong album (co ten album/Track No.) -> van duoc tu tra cuu",
  isOrdinarySong({ title: "JACK - J97 | LƯU NIÊN | Album TAM THÁI TỬ - Track No.4", durationSeconds: 242 }),
);
check(
  "Lien khuc (LK) -> BO QUA",
  !isOrdinarySong({ title: "LK Qua Đêm Nay - Quốc Thiên & Phương Linh", durationSeconds: 285 }),
);
check("Lien khuc viet day du -> BO QUA", !isOrdinarySong({ title: "Liên Khúc Tình Buồn 2026", durationSeconds: 300 }));
check(
  "Mix / nonstop / mashup / medley -> BO QUA",
  [
    "Vinahouse Mix 2026",
    "Nonstop Nhạc Trẻ",
    "Mashup 2026",
    "Medley Tình Ca",
    "Mega Mix Sôi Động",
  ].every((title) => !isOrdinarySong({ title, durationSeconds: 300 })),
);
check(
  "Tuyen tap / tong hop / best of / top N / vol N -> BO QUA",
  ["Tuyển tập nhạc hay", "Tổng hợp nhạc xuân", "Best of 2026", "Top 10 ca khúc", "Vol 3 Chọn Lọc"].every(
    (title) => !isOrdinarySong({ title, durationSeconds: 300 }),
  ),
);
check(
  "Tieu de gom 4 doan ngan cach '|' -> BO QUA (thuong la muc ghep nhieu bai)",
  !isOrdinarySong({ title: "Nhạc A | Nhạc B | Nhạc C | Nhạc D", durationSeconds: 200 }),
);
check(
  "Bai dai hon 10 phut -> BO QUA; dung 10 phut thi van tra cuu",
  !isOrdinarySong({ title: "Nhạc Chill Đêm", durationSeconds: AUTO_LYRICS_MAX_DURATION_SECONDS + 1 }) &&
    isOrdinarySong({ title: "Nhạc Chill Đêm", durationSeconds: AUTO_LYRICS_MAX_DURATION_SECONDS }),
);
check(
  "Ly do bo qua noi ro cho nguoi dung biet",
  (autoLyricsSkipReason({ title: "LK Qua Đêm Nay", durationSeconds: 300 }) ?? "").includes("LK") &&
    (autoLyricsSkipReason({ title: "Nhạc Chill", durationSeconds: 1200 }) ?? "").includes("10 phút"),
);

/* --------------------------- Manh ghep service / API / UI -------------------- */

const root = process.cwd();
const serviceSource = readFileSync(path.join(root, "src", "services", "lyrics.service.ts"), "utf8");
check(
  "Service goi LRCLIB qua lop fetch an toan (co gioi han host + thoi gian cho)",
  serviceSource.includes("fetchJsonSafely") &&
    serviceSource.includes('const LRCLIB_HOSTS = ["lrclib.net"]') &&
    serviceSource.includes("LRCLIB_TIMEOUT_MS"),
);
check(
  "Loi duoc CACHE trong bang song_lyrics",
  serviceSource.includes("prisma.songLyrics.upsert") && serviceSource.includes("prisma.songLyrics.findUnique"),
);
check(
  "Khong tim thay thi chi tra cuu lai sau vai ngay",
  serviceSource.includes("LYRICS_RETRY_AFTER_DAYS") && serviceSource.includes("isCacheReusable"),
);
check(
  "Loi dan tay khong bi ghi de boi tra cuu tu dong",
  serviceSource.includes('source: "MANUAL"') && serviceSource.includes("allowUnpublished"),
);
/*
 * Loi da gap khi thu that: LRCLIB chap chon -> neu coi do la loi he thong (500/502) thi nguoi dung
 * tuong tinh nang hong. Nay tra ket qua rong co co `unavailable` va KHONG ghi cache de con thu lai
 * (ghi cache se bi hieu la "bai nay khong co loi" suot 14 ngay).
 */
check(
  "Loi mang khi tra cuu -> bao 'unavailable' va khong ghi cache",
  serviceSource.includes("unavailable: true") &&
    serviceSource.includes("if (lookup.unavailable)") &&
    serviceSource.includes("LRCLIB_ATTEMPTS"),
);
/*
 * Loi da gap khi thu that voi thu vien tieng Viet: truong `artist` thuong la KENH YouTube hoac nguoi
 * remix ("May Saigon Official", "VietZ") -> loc theo nghe si lam mat ket qua dung. Vi vay sau khi
 * tim kem nghe si that bai, he thong tim lai CHI theo ten bai.
 */
check(
  "Tim lai khong kem nghe si (nghe si trong thu vien thuong la kenh/nguoi remix)",
  serviceSource.includes("buildParams(track, null)"),
);
check(
  "Co ngan sach so lan goi + tran thoi gian tra cuu LRCLIB",
  serviceSource.includes("LRCLIB_REQUEST_BUDGET") && serviceSource.includes("LRCLIB_TOTAL_BUDGET_MS"),
);

/* ------------------- Them bai moi la tu lay loi + lay hang loat ------------------- */

const songsRouteSource = readFileSync(path.join(root, "src", "app", "api", "songs", "route.ts"), "utf8");
check(
  "Them bai moi xong la tu lay loi o NEN (khong lam cham phan hoi)",
  songsRouteSource.includes("void warmLyricsCache([song.id])"),
);

const backfillSource = readFileSync(
  path.join(root, "src", "app", "api", "admin", "lyrics", "backfill", "route.ts"),
  "utf8",
);
check(
  "API lay loi hang loat ton tai va chi quan tri vien dung duoc",
  backfillSource.includes("requireApiAdmin") &&
    backfillSource.includes("listSongIdsMissingLyrics") &&
    backfillSource.includes("warmLyricsCache"),
);
check(
  "Moi lan lay hang loat co gioi han so bai (khong treo request)",
  backfillSource.includes("MAX_PER_RUN") && backfillSource.includes("remaining"),
);

const backfillButtonSource = readFileSync(
  path.join(root, "src", "components", "admin", "lyrics-backfill-button.tsx"),
  "utf8",
);
check(
  "Nut 'lay loi cho cac bai chua co' co trong thu vien nhac",
  readFileSync(path.join(root, "src", "app", "admin", "music", "page.tsx"), "utf8").includes(
    "<LyricsBackfillButton",
  ) && backfillButtonSource.includes("/api/admin/lyrics/backfill"),
);
check(
  "Nut lay hang loat tu dung khi het bai hoac khong con tien trien (khong bam mai khong dung)",
  backfillButtonSource.includes("MAX_BATCHES") &&
    backfillButtonSource.includes("remaining ?? 0) === 0") &&
    backfillButtonSource.includes("!progressed"),
);
check(
  "Service co ham liet ke + dem bai chua co loi",
  serviceSource.includes("export async function listSongIdsMissingLyrics") &&
    serviceSource.includes("export async function countSongsMissingLyrics") &&
    serviceSource.includes("JUST_TRIED_WINDOW_MS"),
);

/* --------------- Chi tu tra cuu cho "bai hat binh thuong" (bo qua LK/mix/tuyen tap) --------------- */

const lyricsRouteSource = readFileSync(
  path.join(root, "src", "app", "api", "songs", "[id]", "lyrics", "route.ts"),
  "utf8",
);
check(
  "Service chan tra cuu tu dong voi LK/mix/tuyen tap (kem tuy chon `force` cho quan tri vien)",
  serviceSource.includes("autoLyricsSkipReason(song)") && serviceSource.includes("options.force"),
);
check(
  "API chi cho quan tri vien dung `force=1` de thu tra cuu bai bi bo qua",
  lyricsRouteSource.includes('searchParams.get("force") === "1"') &&
    lyricsRouteSource.includes('user?.role === "ADMIN"'),
);
check(
  "Danh sach 'bai chua co loi' loai tru LK/mix/tuyen tap (chi lay bai don)",
  serviceSource.includes("filter((song) => isOrdinarySong(song))") ||
    serviceSource.includes("songs.filter((song) => isOrdinarySong(song))"),
);

const routeSource = readFileSync(path.join(root, "src", "app", "api", "songs", "[id]", "lyrics", "route.ts"), "utf8");
check("API lyrics co GET (publish cache) ", routeSource.includes("export const GET") && routeSource.includes("getSongLyrics"));
check("API lyrics co POST (quan tri vien dan loi)", routeSource.includes("export const POST") && routeSource.includes("saveManualLyrics"));
check("API lyrics co DELETE (xoa cache de tra cuu lai)", routeSource.includes("export const DELETE") && routeSource.includes("clearSongLyrics"));
check(
  "Chi quan tri vien duoc dan/xoa loi",
  (routeSource.match(/requireApiAdmin\(\)/g) ?? []).length === 2,
  String((routeSource.match(/requireApiAdmin\(\)/g) ?? []).length),
);

const proxySource = readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
check("Proxy cho khach GET /api/songs/:id/lyrics", /\\\/api\\\/songs\\\/\[\^\/\]\+\\\/lyrics\$/.test(proxySource));

const panelSource = readFileSync(path.join(root, "src", "components", "player", "lyrics-panel.tsx"), "utf8");
check("Bang loi to dong dang hat bang tim kiem nhi phan", panelSource.includes("findActiveLyricIndex(lines, positionMs)"));
check("Bang loi tu cuon dong dang hat (va nhuong quyen khi nguoi dung tu cuon)", panelSource.includes("container.scrollTo") && panelSource.includes("lastUserScrollAt"));
check("Bang loi co danh dau dong dang hat cho trinh doc man hinh", panelSource.includes("aria-current={index === activeIndex"));
check("Bang loi cho bam vao dong de tua", panelSource.includes("seekToLine(line.timeMs)") && panelSource.includes("requestSeekPosition"));
check("Bang loi co chinh lech loi so voi nhac", panelSource.includes("nudge(-LYRIC_OFFSET_STEP_MS)") && panelSource.includes("nudge(LYRIC_OFFSET_STEP_MS)"));
check("Bang loi ton trong cai dat giam chuyen dong", panelSource.includes("prefers-reduced-motion"));
check("Bang loi co cho quan tri vien dan loi", panelSource.includes("openEditor") && panelSource.includes("saveLyrics"));
check(
  "Bang loi noi ro vi sao khong tu tim loi (khong im lang) + cho quan tri vien 'Van tra cuu'",
  panelSource.includes("skipReason") && panelSource.includes("Vẫn tra cứu") && panelSource.includes("force=1"),
);

const fullPlayerSource = readFileSync(path.join(root, "src", "components", "player", "full-player.tsx"), "utf8");
const barSource = readFileSync(path.join(root, "src", "components", "player", "player-bar.tsx"), "utf8");
check("Trinh phat day du hien bang loi", fullPlayerSource.includes("<LyricsPanel />"));
check("Thanh phat co nut mo loi bai hat", barSource.includes('title="Lời bài hát (Y)"'));
check("Nut loi mo luon trinh phat day du (bang loi chi hien o do)", barSource.includes("showLyrics()"));

const storeSource = readFileSync(path.join(root, "src", "store", "player-store.ts"), "utf8");
const shortcutsSource = readFileSync(path.join(root, "src", "components", "player", "player-shortcuts.tsx"), "utf8");
check("Store co trang thai bang loi (khong luu localStorage)", storeSource.includes("lyricsOpen: boolean") && storeSource.includes("showLyrics"));
check("Phim tat Y mo/dong loi bai hat", shortcutsSource.includes('case "lyrics"') && shortcutsSource.includes("store.showLyrics()"));
check(
  "Phim tat Y nam trong bang tro giup kem nhan ro rang",
  PLAYER_SHORTCUTS.some((item) => item.action === "lyrics" && item.keys.includes("Y") && item.label.includes("lời")),
);

/* ------------------------------- CSDL that ----------------------------------- */

/** Du lieu LRC mau de dan vao bai that (co offset + nhieu dong) */
const MANUAL_LRC = "[offset:-500]\n[00:01.00]Dòng kiểm tra một\n[00:05.50]Dòng kiểm tra hai";
const MANUAL_PLAIN = "Lời thường\nkhông có mốc thời gian";

type LyricsRowBackup = Awaited<ReturnType<typeof prisma.songLyrics.findUnique>>;

/** Tra dong cache loi ve nguyen trang truoc khi kiem tra (upsert de an toan ca khi dong da bi xoa) */
async function restoreLyricsRow(backup: LyricsRowBackup): Promise<void> {
  if (!backup) return;

  const data = {
    syncedLyrics: backup.syncedLyrics,
    plainLyrics: backup.plainLyrics,
    source: backup.source,
    matchedTrack: backup.matchedTrack,
    matchedArtist: backup.matchedArtist,
    updatedById: backup.updatedById,
  };

  await prisma.songLyrics.upsert({
    where: { songId: backup.songId },
    create: { songId: backup.songId, ...data },
    update: data,
  });
}

async function runDatabaseCheck(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    skip("Loi bai hat tren CSDL", "khong co DATABASE_URL");
    return;
  }

  try {
    const song = await prisma.song.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, title: true } });
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

    if (!song || !admin) {
      skip("Loi bai hat tren CSDL", "chua co bai nhac hoac quan tri vien de kiem tra");
      return;
    }

    /* Sao luu dong cache dang co de tra lai nguyen trang sau khi kiem tra */
    const backup = await prisma.songLyrics.findUnique({ where: { songId: song.id } });

    const saved = await saveManualLyrics(song.id, admin.id, MANUAL_LRC);
    check("Dan loi tay: nhan dien duoc moc thoi gian (karaoke)", saved.synced && saved.lines.length === 2, `${saved.lines.length} dong`);
    check("Dan loi tay: luu dung nguon MANUAL", saved.source === "MANUAL", saved.source);
    check("Dan loi tay: doc duoc the offset trong LRC", saved.offsetMs === -500, String(saved.offsetMs));

    const cached = await getSongLyrics(song.id);
    check("Doc lai: dung cache trong CSDL (khong goi mang)", cached.source === "MANUAL" && cached.lines.length === 2);
    check(
      "Doc lai: moc thoi gian giu nguyen",
      cached.lines[0].timeMs === 1000 && cached.lines[1].timeMs === 5500,
      JSON.stringify(cached.lines.map((line) => line.timeMs)),
    );

    const plainSaved = await saveManualLyrics(song.id, admin.id, MANUAL_PLAIN);
    check("Dan loi thuong (khong moc): khong bat che do karaoke", !plainSaved.synced && plainSaved.lines.length === 0);
    check("Dan loi thuong: van hien duoc van ban", (plainSaved.plain ?? "").includes("Lời thường"));

    let emptyMessage = "";
    try {
      await saveManualLyrics(song.id, admin.id, "   ");
    } catch (error) {
      emptyMessage = error instanceof Error ? error.message : String(error);
    }
    check("Dan loi rong -> bao loi ro rang, khong luu", emptyMessage.includes("không được để trống"), emptyMessage);

    let missingMessage = "";
    try {
      await getSongLyrics("khong-ton-tai");
    } catch (error) {
      missingMessage = error instanceof Error ? error.message : String(error);
    }
    check("Bai khong ton tai -> bao loi ro rang", missingMessage.includes("không tồn tại"), missingMessage);

    const cleared = await clearSongLyrics(song.id);
    const afterClear = await prisma.songLyrics.findUnique({ where: { songId: song.id } });
    check("Xoa cache: xoa dung ban ghi cua bai", cleared === 1 && afterClear === null, `${cleared} ban ghi`);

    /* Tra lai du lieu cu (neu bai nay da co cache truoc khi kiem tra) */
    if (backup) {
      await restoreLyricsRow(backup);
      check("Khoi phuc cache cu cua bai kiem tra", true);
    } else {
      skip("Khoi phuc cache cu", "bai kiem tra truoc do chua co cache");
    }

    /* ------------------- Lay loi hang loat (them bai moi + nut trong quan tri) ---------------- */

    const missingBefore = await countSongsMissingLyrics();
    check("Dem duoc so bai chua co loi", Number.isInteger(missingBefore) && missingBefore >= 0, String(missingBefore));

    await clearSongLyrics(song.id);
    const missingIds = await listSongIdsMissingLyrics(50);
    check(
      "Bai chua co dong cache duoc liet ke la 'chua co loi'",
      Array.isArray(missingIds) && missingIds.includes(song.id),
      `${missingIds.length} bai`,
    );

    const warm = await warmLyricsCache([song.id]);
    check(
      "Lam am cache: moi bai chi thu mot lan va luon co ket qua phan loai",
      warm.attempted === 1 && warm.found + warm.missing + warm.unavailable === 1,
      JSON.stringify(warm),
    );

    if (warm.unavailable === 1) {
      skip("Lam am cache: ghi cache sau khi tra cuu", "mang loi nen khong ghi cache (dung thiet ke)");
    } else {
      const afterWarm = await prisma.songLyrics.findUnique({ where: { songId: song.id } });
      check(
        "Lam am cache: tra cuu xong la co dong cache (lan sau mo bai la co ngay)",
        afterWarm !== null,
        afterWarm ? `nguon: ${afterWarm.source}` : "khong co dong nao",
      );

      const missingAfter = await listSongIdsMissingLyrics(50);
      check(
        "Bai vua tra cuu xong khong bi chon lai ngay (nut 'lay hang loat' khong lap vo han)",
        !missingAfter.includes(song.id),
        `${missingAfter.length} bai`,
      );
    }

    await restoreLyricsRow(backup);

    /* ------------------- Bai khong phai "bai don" thi khong tu tra cuu ------------------- */

    const nonOrdinary = await prisma.song.findFirst({
      where: { title: { startsWith: "LK" } },
      select: { id: true, title: true },
    });

    if (!nonOrdinary) {
      skip("Bai lien khuc (LK) bi loai khoi danh sach tu tra cuu", "thu vien khong co bai nao bat dau bang 'LK'");
    } else {
      const mixLyrics = await getSongLyrics(nonOrdinary.id);
      check(
        "Bai lien khuc (LK) KHONG bi tra cuu tu dong (co ly do ro rang)",
        Boolean(mixLyrics.skipReason) && mixLyrics.lines.length === 0,
        mixLyrics.skipReason ?? "THIEU LY DO (loi)",
      );

      /* Du cache tu dong cu co du lieu thi van khong hien (luat cu co the da lay sai bai) */
      await prisma.songLyrics.upsert({
        where: { songId: nonOrdinary.id },
        create: {
          songId: nonOrdinary.id,
          syncedLyrics: "[00:01.00]Lời nghi là sai",
          plainLyrics: "Lời nghi là sai",
          source: "LRCLIB",
          matchedTrack: "Bài khác",
          matchedArtist: "Ai đó",
        },
        update: {
          syncedLyrics: "[00:01.00]Lời nghi là sai",
          plainLyrics: "Lời nghi là sai",
          source: "LRCLIB",
          matchedTrack: "Bài khác",
          matchedArtist: "Ai đó",
        },
      });

      const mixWithCache = await getSongLyrics(nonOrdinary.id);
      check(
        "Cache TU DONG cu cua bai LK cung khong duoc hien (tranh loi cu sai)",
        Boolean(mixWithCache.skipReason) && mixWithCache.lines.length === 0,
      );

      /* Nhung loi dan tay thi luon duoc hien */
      await saveManualLyrics(nonOrdinary.id, admin.id, "[00:01.00]Lời do quản trị viên dán");
      const mixManual = await getSongLyrics(nonOrdinary.id);
      check(
        "Loi do quan tri vien dan tay van hien binh thuong voi bai LK",
        mixManual.lines.length === 1 && mixManual.confidence === "manual",
      );

      await clearSongLyrics(nonOrdinary.id);
      const missingMix = await listSongIdsMissingLyrics(50);
      check(
        "Bai lien khuc (LK) khong nam trong danh sach 'lay loi hang loat'",
        !missingMix.includes(nonOrdinary.id),
        `${missingMix.length} bai duoc chon`,
      );
    }

    console.log(`\nBai kiem tra: ${song.title}`);
  } catch (error) {
    skip("Loi bai hat tren CSDL", error instanceof Error ? error.message : String(error));
  }
}

/** Tra cuu LRCLIB that su (can mang) - loi mang thi bao SKIP chu khong danh FAIL */
async function runNetworkCheck(): Promise<void> {
  try {
    const result = await lookupLyrics({ title: "Shape of You", artist: "Ed Sheeran", durationSeconds: 234 });

    if (result.unavailable) {
      skip("Tra cuu LRCLIB that", "dich vu tam thoi khong phan hoi (da thu lai 2 lan)");
      return;
    }

    if (!result.match) {
      skip("Tra cuu LRCLIB that", "khong tim thay ban ghi (co the API doi cach phan hoi)");
      return;
    }

    check(
      "Tra cuu LRCLIB that: lay duoc loi bai hat",
      Boolean(result.match.syncedLyrics || result.match.plainLyrics),
      `co moc thoi gian: ${Boolean(result.match.syncedLyrics)} | loi thuong: ${Boolean(result.match.plainLyrics)}`,
    );
  } catch (error) {
    skip("Tra cuu LRCLIB that", error instanceof Error ? error.message : String(error));
  }
}

/** In ket qua va dat ma thoat (chay sau khi phan kiem tra CSDL/mang xong) */
function report(): void {
  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void (async () => {
  await runDatabaseCheck();
  if (process.env.SKIP_NETWORK !== "1") await runNetworkCheck();
  await prisma.$disconnect().catch(() => undefined);
  report();
})();
