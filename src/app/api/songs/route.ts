import type { NextRequest } from "next/server";

import { created, handleApi, ok } from "@/lib/api/response";
import { getActiveSessionUser, requireApiAdmin } from "@/lib/auth/guards";
import { createSongSchema, songListQuerySchema } from "@/lib/validations/song";

import { createSong, listSongs } from "@/services/song.service";
import { warmLyricsCache } from "@/services/lyrics.service";

/**
 * GET /api/songs - danh sach bai nhac.
 * Khach (chua dang nhap) van xem duoc de nghe nhac mien phi.
 */
export const GET = handleApi(async (request: NextRequest) => {
  const user = await getActiveSessionUser();

  const searchParams = request.nextUrl.searchParams;
  const query = songListQuerySchema.parse({
    q: searchParams.get("q") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    // Khach chi xem bai da xuat ban, tru khi ho la quan tri vien
    scope:
      user?.role === "ADMIN" && searchParams.get("scope") === "all" ? "all" : "published",
  });

  const result = await listSongs(query, { userId: user?.id });
  return ok(result);
});

/** POST /api/songs - them bai nhac moi (chi quan tri vien) */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = createSongSchema.parse(payload);
  const song = await createSong(input, guard.user.id);

  /*
   * Lay loi NGAY khi them bai, chay NEN (khong `await`):
   *  - nguoi dung mo bai lan dau la da co loi, khong phai ngoi cho mang;
   *  - khong lam cham phan hoi them bai; bai khong co loi tren LRCLIB thi ghi nho luon
   *    (tranh goi lai lien tuc); loi mang thi bo qua, lan mo sau se tra cuu lai.
   */
  void warmLyricsCache([song.id]);

  return created(song);
});
