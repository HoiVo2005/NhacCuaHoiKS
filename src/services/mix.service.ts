import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { MIX_DEFAULT_SIZE, MIX_MAX_SIZE, rankMixCandidates, type MixScore } from "@/lib/music/mix";
import type { SongDTO } from "@/types";

import { mapWithFavorites, songInclude } from "./song.service";

/** Số ứng viên lấy tối đa cho MỖI nhóm tương đồng (thể loại / nghệ sĩ / nguồn phát) */
const MIX_POOL_PER_GROUP = 80;

/** Số bài nghe nhiều nhất dùng để "lấp đầy" mix khi thư viện còn ít bài tương đồng */
const MIX_FALLBACK_POOL = 40;

export interface SongMix {
  /** Bài gốc (bài đang phát khi người dùng bấm "Mix quanh bài này") */
  seed: SongDTO;
  /** Danh sách bài của mix, đã xếp theo độ tương đồng */
  songs: SongDTO[];
}

function clampLimit(limit: number | undefined): number {
  const value = Math.round(limit ?? MIX_DEFAULT_SIZE);
  if (!Number.isFinite(value)) return MIX_DEFAULT_SIZE;
  return Math.min(Math.max(value, 1), MIX_MAX_SIZE);
}

/**
 * Tạo "Mix quanh bài này": lấy bài gốc, gom các bài tương đồng từ 3 nguồn
 * (cùng thể loại / cùng nghệ sĩ / cùng nền tảng phát), chấm điểm rồi xếp hạng.
 *
 * Vì sao chia 3 truy vấn thay vì một `OR`: mỗi nhóm cần `take` riêng để một thể loại lớn
 * không "nuốt" hết kết quả trước khi kịp lấy bài của nghệ sĩ (nhóm nào cũng có đất diễn).
 */
export async function buildSongMix(
  songId: string,
  options: { userId?: string | null; limit?: number } = {},
): Promise<SongMix> {
  const seedRow = await prisma.song.findFirst({
    where: { id: songId, isPublished: true },
    include: songInclude,
  });

  if (!seedRow) {
    throw new ServiceError("Bài nhạc không tồn tại hoặc chưa phát hành.", 404, "SONG_NOT_FOUND");
  }

  const [seed] = await mapWithFavorites([seedRow], options.userId);
  const limit = clampLimit(options.limit);

  const groups = await Promise.all(
    [
      seedRow.genreId
        ? prisma.song.findMany({
            where: { isPublished: true, id: { not: songId }, genreId: seedRow.genreId },
            include: songInclude,
            orderBy: { playCount: "desc" },
            take: MIX_POOL_PER_GROUP,
          })
        : null,
      seedRow.artist
        ? prisma.song.findMany({
            where: { isPublished: true, id: { not: songId }, artist: seedRow.artist },
            include: songInclude,
            orderBy: { playCount: "desc" },
            take: MIX_POOL_PER_GROUP,
          })
        : null,
      prisma.song.findMany({
        where: { isPublished: true, id: { not: songId }, sourceType: seedRow.sourceType },
        include: songInclude,
        orderBy: { playCount: "desc" },
        take: MIX_POOL_PER_GROUP,
      }),
    ].map((query) => query ?? Promise.resolve([])),
  );

  const candidates = await mapWithFavorites(groups.flat(), options.userId);
  const ranked: MixScore[] = rankMixCandidates(seed, candidates, limit);

  // Thư viện nhỏ (hoặc bài mới chưa có bài tương đồng): bù bằng bài nghe nhiều nhất
  if (ranked.length < limit) {
    const picked = new Set([seed.id, ...ranked.map((item) => item.song.id)]);
    const fillRows = await prisma.song.findMany({
      where: { isPublished: true, id: { notIn: [...picked] } },
      include: songInclude,
      orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
      take: MIX_FALLBACK_POOL,
    });

    for (const song of await mapWithFavorites(fillRows, options.userId)) {
      if (ranked.length >= limit) break;
      if (picked.has(song.id)) continue;
      picked.add(song.id);
      ranked.push({ song, score: 0, reasons: ["Bài nghe nhiều trong thư viện"] });
    }
  }

  return { seed, songs: ranked.map((item) => item.song) };
}
