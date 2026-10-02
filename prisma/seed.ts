import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@prisma/client";

/**
 * Seed du lieu mau cho NhacCuaHoiKS.
 * Chay: npm run db:seed
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

interface SeedSong {
  title: string;
  artist: string;
  genre: string;
  source: "YOUTUBE" | "SOUNDCLOUD" | "TIKTOK" | "UPLOADED";
  sourceId?: string;
  sourceUrl?: string;
  embedUrl?: string;
  streamUrl?: string;
  durationSeconds?: number;
  tags?: string;
  storageKey?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

const YOUTUBE_SONGS: SeedSong[] = [
  { title: "Never Gonna Give You Up", artist: "Rick Astley", genre: "pop", source: "YOUTUBE", sourceId: "dQw4w9WgXcQ", durationSeconds: 213, tags: "kinh điển, 80s" },
  { title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", genre: "pop", source: "YOUTUBE", sourceId: "OPf0YbXqDm0", durationSeconds: 271, tags: "funk, sôi động" },
  { title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", genre: "pop", source: "YOUTUBE", sourceId: "kJQP7kiw5Fk", durationSeconds: 282, tags: "latin" },
  { title: "Shape of You", artist: "Ed Sheeran", genre: "pop", source: "YOUTUBE", sourceId: "JGwWNGJdvx8", durationSeconds: 264, tags: "acoustic" },
  { title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", genre: "pop", source: "YOUTUBE", sourceId: "RgKAFK5djSk", durationSeconds: 230, tags: "ballad" },
  { title: "Bohemian Rhapsody", artist: "Queen", genre: "rock", source: "YOUTUBE", sourceId: "fJ9rUzIMcZQ", durationSeconds: 355, tags: "kinh điển, rock" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana", genre: "rock", source: "YOUTUBE", sourceId: "hTWKbfoikeg", durationSeconds: 301, tags: "grunge" },
  { title: "Radioactive", artist: "Imagine Dragons", genre: "rock", source: "YOUTUBE", sourceId: "ktvTqknDobU", durationSeconds: 297, tags: "alternative" },
  { title: "Hello", artist: "Adele", genre: "chill", source: "YOUTUBE", sourceId: "YQHsXMglC9A", durationSeconds: 367, tags: "ballad, thư giãn" },
  { title: "Perfect", artist: "Ed Sheeran", genre: "chill", source: "YOUTUBE", sourceId: "2Vv-BfVoq4g", durationSeconds: 279, tags: "ballad" },
  { title: "Thinking Out Loud", artist: "Ed Sheeran", genre: "chill", source: "YOUTUBE", sourceId: "lp-EO5I60KA", durationSeconds: 281, tags: "ballad" },
  { title: "Roar", artist: "Katy Perry", genre: "pop", source: "YOUTUBE", sourceId: "CevxZvSJLk8", durationSeconds: 270, tags: "sôi động" },
  { title: "Blank Space", artist: "Taylor Swift", genre: "pop", source: "YOUTUBE", sourceId: "e-ORhEE9VVg", durationSeconds: 273, tags: "pop" },
  { title: "Faded", artist: "Alan Walker", genre: "edm", source: "YOUTUBE", sourceId: "60ItHLz5WEA", durationSeconds: 212, tags: "edm, remix" },
  { title: "Hymn for the Weekend", artist: "Coldplay", genre: "chill", source: "YOUTUBE", sourceId: "YykjpeuMNEk", durationSeconds: 258, tags: "chill" },
  { title: "Sugar", artist: "Maroon 5", genre: "pop", source: "YOUTUBE", sourceId: "09R8_2nJtjg", durationSeconds: 301, tags: "pop" },
  { title: "Love The Way You Lie", artist: "Eminem ft. Rihanna", genre: "hiphop", source: "YOUTUBE", sourceId: "uelHwf8o7_U", durationSeconds: 267, tags: "rap" },
  { title: "Waka Waka (This Time for Africa)", artist: "Shakira", genre: "pop", source: "YOUTUBE", sourceId: "pRpeEdMmmQ0", durationSeconds: 211, tags: "world cup" },
  { title: "Attention", artist: "Charlie Puth", genre: "pop", source: "YOUTUBE", sourceId: "nfs8NYg7yQM", durationSeconds: 208, tags: "pop" },
  { title: "Chandelier", artist: "Sia", genre: "pop", source: "YOUTUBE", sourceId: "2vjPBrBU-TM", durationSeconds: 216, tags: "pop" },
];

/**
 * Cac link SoundCloud nay da duoc kiem chung con hoat dong
 * bang `npx tsx scripts/find-live-soundcloud.ts` (cap nhat 24/09/2026).
 * Thoi luong doc truc tiep tu trang bai nhac cong khai + Widget API chinh thuc.
 */
const SOUNDCLOUD_SONGS: SeedSong[] = [
  {
    title: "Flickermood",
    artist: "Forss",
    genre: "chill",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/forss/flickermood",
    durationSeconds: 214,
    tags: "electronic, downtempo",
  },
  {
    title: "Believer",
    artist: "Imagine Dragons",
    genre: "rock",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/imaginedragons/believer",
    durationSeconds: 204,
    tags: "alternative",
  },
  {
    title: "Latch (feat. Sam Smith)",
    artist: "Disclosure",
    genre: "edm",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/disclosuremusic/latch",
    durationSeconds: 209,
    tags: "house",
  },
  {
    title: "Alone (Original Mix)",
    artist: "Marshmello",
    genre: "edm",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/marshmellomusic/alone",
    durationSeconds: 274,
    tags: "future bass",
  },
  {
    title: "Holdin On",
    artist: "Flume",
    genre: "edm",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/flume/holdin-on",
    durationSeconds: 152,
    tags: "future bass",
  },
  {
    title: "100 Bad Days",
    artist: "AJR",
    genre: "pop",
    source: "SOUNDCLOUD",
    sourceUrl: "https://soundcloud.com/ajrbrothers/100-bad-days",
    durationSeconds: 213,
    tags: "indie pop",
  },
];

const UPLOADED_SONGS: SeedSong[] = [
  {
    title: "NhacCuaHoiKS Demo Tone",
    artist: "Hệ thống NhacCuaHoiKS",
    genre: "chill",
    source: "UPLOADED",
    streamUrl: "/demo/nhaccuahoiks-demo.wav",
    durationSeconds: 15,
    tags: "demo, file nội bộ",
    mimeType: "audio/wav",
    fileSizeBytes: 480000,
  },
];

const GENRES = [
  { name: "Pop", slug: "pop", color: "#ec4899", description: "Nhạc pop phổ thông, dễ nghe" },
  { name: "Rock", slug: "rock", color: "#f43f5e", description: "Rock kinh điển và hiện đại" },
  { name: "Chill / Lofi", slug: "chill", color: "#22d3ee", description: "Nhạc nhẹ nhàng, phù hợp khi làm việc" },
  { name: "EDM", slug: "edm", color: "#8b5cf6", description: "Nhạc điện tử, dance" },
  { name: "Hip-hop / Rap", slug: "hiphop", color: "#f59e0b", description: "Hip-hop và rap" },
];

function buildEmbedUrl(song: SeedSong): string | null {
  if (song.embedUrl) return song.embedUrl;

  if (song.source === "YOUTUBE" && song.sourceId) {
    return `https://www.youtube-nocookie.com/embed/${song.sourceId}`;
  }

  if (song.source === "SOUNDCLOUD" && song.sourceUrl) {
    const params = new URLSearchParams({
      url: song.sourceUrl,
      color: "#8b5cf6",
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "true",
      show_reposts: "false",
      visual: "true",
    });
    return `https://w.soundcloud.com/player/?${params.toString()}`;
  }

  return null;
}

function buildThumbnail(song: SeedSong): string | null {
  if (song.source === "YOUTUBE" && song.sourceId) {
    return `https://i.ytimg.com/vi/${song.sourceId}/hqdefault.jpg`;
  }
  return null;
}

async function seedUsersAndGenres() {
  /*
   * Mat khau tai khoan mau. Co the doi qua bien moi truong khi seed (nen dat khi trien khai that):
   *   SEED_ADMIN_PASSWORD, SEED_EMPLOYEE_PASSWORD
   * Mac dinh la gia tri trong README - CHI dung cho moi truong thu nghiem.
   */
  const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const employeePasswordPlain = process.env.SEED_EMPLOYEE_PASSWORD || "NhanVien@123456";

  const [adminPassword, employeePassword] = await Promise.all([
    bcrypt.hash(adminPasswordPlain, 12),
    bcrypt.hash(employeePasswordPlain, 12),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mymusic.local" },
    update: { isActive: true, role: "ADMIN" },
    create: {
      email: "admin@mymusic.local",
      name: "Quản trị viên",
      role: "ADMIN",
      passwordHash: adminPassword,
      isActive: true,
    },
  });

  const employeeOne = await prisma.user.upsert({
    where: { email: "nhanvien@mymusic.local" },
    update: { isActive: true },
    create: {
      email: "nhanvien@mymusic.local",
      name: "Nguyễn Văn An",
      role: "EMPLOYEE",
      passwordHash: employeePassword,
      isActive: true,
    },
  });

  const employeeTwo = await prisma.user.upsert({
    where: { email: "thuha@mymusic.local" },
    update: { isActive: true },
    create: {
      email: "thuha@mymusic.local",
      name: "Trần Thu Hà",
      role: "EMPLOYEE",
      passwordHash: employeePassword,
      isActive: true,
    },
  });

  const genreIdBySlug = new Map<string, string>();
  for (const genre of GENRES) {
    const record = await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name, color: genre.color, description: genre.description },
      create: genre,
    });
    genreIdBySlug.set(genre.slug, record.id);
  }

  console.log(`  • Người dùng: 3 (admin + 2 nhân viên)`);
  console.log(`  • Thể loại: ${genreIdBySlug.size}`);

  return { admin, employeeOne, employeeTwo, genreIdBySlug };
}

async function seedSongs(adminId: string, genreIdBySlug: Map<string, string>) {
  const seedSongs = [...YOUTUBE_SONGS, ...SOUNDCLOUD_SONGS, ...UPLOADED_SONGS];
  let inserted = 0;

  for (const song of seedSongs) {
    const existing = song.sourceId
      ? await prisma.song.findFirst({
          where: { sourceType: song.source, sourceId: song.sourceId },
          select: { id: true },
        })
      : await prisma.song.findFirst({
          where: { sourceType: song.source, title: song.title },
          select: { id: true },
        });

    if (existing) continue;

    await prisma.song.create({
      data: {
        title: song.title,
        artist: song.artist,
        description:
          song.source === "SOUNDCLOUD"
            ? "Nguồn mẫu: nếu widget báo lỗi, hãy cập nhật lại đường dẫn SoundCloud trong trang quản trị."
            : null,
        durationSeconds: song.durationSeconds ?? 0,
        thumbnailUrl: buildThumbnail(song),
        sourceType: song.source,
        sourceId: song.sourceId ?? null,
        sourceUrl: song.sourceUrl ?? null,
        streamUrl: song.streamUrl ?? null,
        embedUrl: buildEmbedUrl(song),
        playbackType: song.source === "UPLOADED" ? "DIRECT" : "EMBED",
        mimeType: song.mimeType ?? null,
        fileSizeBytes: song.fileSizeBytes ?? null,
        storageKey: song.storageKey ?? null,
        tags: song.tags ?? null,
        genreId: genreIdBySlug.get(song.genre) ?? null,
        isPublished: true,
        createdById: adminId,
        updatedById: adminId,
      },
    });

    inserted += 1;
  }

  console.log(`  • Bài nhạc mới: ${inserted}/${seedSongs.length}`);
}

async function seedPlaylists(adminId: string, employeeId: string) {
  const playlists = [
    {
      name: "Nhạc tập trung làm việc",
      description: "Danh sách nhạc nhẹ giúp tập trung trong giờ làm việc.",
      isFeatured: true,
      isPublic: true,
      ownerId: adminId,
      titles: [
        "Hello",
        "Perfect",
        "Thinking Out Loud",
        "Hymn for the Weekend",
        "NhacCuaHoiKS Demo Tone",
        "Flickermood",
        "Holdin On",
      ],
    },
    {
      name: "Khởi động buổi sáng",
      description: "Nhạc sôi động cho đầu ngày làm việc.",
      isFeatured: true,
      isPublic: true,
      ownerId: adminId,
      titles: [
        "Uptown Funk",
        "Shape of You",
        "Sugar",
        "Despacito",
        "Faded",
        "Alone (Original Mix)",
        "Believer",
        "Latch (feat. Sam Smith)",
      ],
    },
    {
      name: "Rock kinh điển",
      description: "Những bản rock bất hủ.",
      isFeatured: true,
      isPublic: true,
      ownerId: adminId,
      titles: ["Bohemian Rhapsody", "Smells Like Teen Spirit", "Radioactive"],
    },
    {
      name: "Playlist của tôi",
      description: "Danh sách phát cá nhân.",
      isFeatured: false,
      isPublic: false,
      ownerId: employeeId,
      titles: ["See You Again", "Hello", "Attention", "Chandelier"],
    },
  ];

  const songs = await prisma.song.findMany({ select: { id: true, title: true } });
  const songIdByTitle = new Map(songs.map((song) => [song.title, song.id]));
  let created = 0;
  let addedItems = 0;

  for (const playlist of playlists) {
    // Idempotent: tao playlist neu chua co, bo sung bai nhac con thieu neu da co
    let record = await prisma.playlist.findFirst({
      where: { name: playlist.name, ownerId: playlist.ownerId },
      select: { id: true },
    });

    if (!record) {
      record = await prisma.playlist.create({
        data: {
          name: playlist.name,
          description: playlist.description,
          isFeatured: playlist.isFeatured,
          isPublic: playlist.isPublic,
          ownerId: playlist.ownerId,
        },
        select: { id: true },
      });
      created += 1;
    }

    const existingItems = await prisma.playlistSong.findMany({
      where: { playlistId: record.id },
      select: { songId: true, position: true },
    });

    const existingSongIds = new Set(existingItems.map((item) => item.songId));
    let position = existingItems.reduce((max, item) => Math.max(max, item.position + 1), 0);

    for (const title of playlist.titles) {
      const songId = songIdByTitle.get(title);
      if (!songId || existingSongIds.has(songId)) continue;

      await prisma.playlistSong.create({
        data: { playlistId: record.id, songId, position, addedById: playlist.ownerId },
      });

      position += 1;
      addedItems += 1;
    }
  }

  console.log(`  • Playlist mới: ${created}/${playlists.length} · bài nhạc thêm vào: ${addedItems}`);
}

/** Tao du lieu nghe nhac 14 ngay gan nhat de dashboard co so lieu thuc te */
async function seedListeningHistory(userIds: string[]) {
  const existing = await prisma.listenHistory.count();
  if (existing > 0) {
    console.log(`  • Bỏ qua lịch sử nghe (đã có ${existing} bản ghi)`);
    return;
  }

  const songs = await prisma.song.findMany({ select: { id: true, durationSeconds: true } });
  if (songs.length === 0) return;

  const rows: {
    userId: string;
    songId: string;
    playedAt: Date;
    msPlayed: number;
    completed: boolean;
    source: string;
  }[] = [];

  const playCounts = new Map<string, number>();

  for (let day = 0; day < 14; day += 1) {
    const playsToday = 3 + Math.floor(Math.random() * 6);

    for (let index = 0; index < playsToday; index += 1) {
      const song = songs[Math.floor(Math.random() * songs.length)];
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const playedAt = new Date();
      playedAt.setDate(playedAt.getDate() - day);
      playedAt.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

      const durationMs = (song.durationSeconds || 210) * 1000;
      const ratio = 0.35 + Math.random() * 0.65;
      const msPlayed = Math.round(durationMs * ratio);

      rows.push({
        userId,
        songId: song.id,
        playedAt,
        msPlayed,
        completed: ratio > 0.9,
        source: "seed",
      });

      playCounts.set(song.id, (playCounts.get(song.id) ?? 0) + 1);
    }
  }

  await prisma.listenHistory.createMany({ data: rows });

  for (const [songId, playCount] of playCounts.entries()) {
    await prisma.song.update({ where: { id: songId }, data: { playCount } });
  }

  console.log(`  • Lịch sử nghe: ${rows.length} lượt trong 14 ngày`);
}

async function main() {
  console.log("→ Seed NhacCuaHoiKS: bắt đầu");

  const { admin, employeeOne, employeeTwo, genreIdBySlug } = await seedUsersAndGenres();
  await seedSongs(admin.id, genreIdBySlug);
  await seedPlaylists(admin.id, employeeOne.id);
  await seedListeningHistory([admin.id, employeeOne.id, employeeTwo.id]);

  console.log("→ Seed NhacCuaHoiKS: hoàn tất");
  /*
   * Chi in mat khau mau khi dang dung gia tri MAC DINH. Neu nguoi trien khai da dat
   * SEED_ADMIN_PASSWORD / SEED_EMPLOYEE_PASSWORD thi khong in ra man hinh nua.
   */
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log("   Đăng nhập quản trị: admin@mymusic.local / Admin@123456");
  }
  if (!process.env.SEED_EMPLOYEE_PASSWORD) {
    console.log("   Đăng nhập nhân viên: nhanvien@mymusic.local / NhanVien@123456");
  }
  console.log("   (Đây là tài khoản MẪU cho môi trường thử nghiệm - hãy đổi mật khẩu trước khi dùng thật.)");
}

main()
  .catch((error) => {
    console.error("✗ Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
