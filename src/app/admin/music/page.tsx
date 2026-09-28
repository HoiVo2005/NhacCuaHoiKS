import Link from "next/link";
import { Music4, PlusCircle } from "lucide-react";

import { AdminSongsTable } from "@/components/admin/admin-songs-table";
import { LyricsBackfillButton } from "@/components/admin/lyrics-backfill-button";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/guards";
import { listGenres } from "@/services/genre.service";
import { countSongsMissingLyrics } from "@/services/lyrics.service";
import { listSongs } from "@/services/song.service";
import { songListQuerySchema } from "@/lib/validations/song";

interface AdminMusicPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminMusicPage({ searchParams }: AdminMusicPageProps) {
  await requireAdminPage();
  const params = await searchParams;

  const query = songListQuerySchema.parse({
    q: params.q,
    page: params.page,
    pageSize: 50,
    scope: "all",
    sort: "newest",
  });

  const [result, genres, missingLyrics] = await Promise.all([
    listSongs(query),
    listGenres(),
    countSongsMissingLyrics(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Music4 className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Thư viện nhạc</h1>
            <p className="text-sm text-muted-foreground">
              {result.total} bài nhạc · quản lý nguồn phát, thể loại và trạng thái phát hành
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lời bài hát: bài thêm mới đã tự lấy lời; nút này bù cho các bài cũ chưa có */}
          <LyricsBackfillButton missing={missingLyrics} />

          <Button asChild size="sm" variant="gradient">
            <Link href="/admin/music/new">
              <PlusCircle /> Thêm bài nhạc
            </Link>
          </Button>
        </div>
      </header>

      <AdminSongsTable initialSongs={result.items} genres={genres} total={result.total} />
    </div>
  );
}
