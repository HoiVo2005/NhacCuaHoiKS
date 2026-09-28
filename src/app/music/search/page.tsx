import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";

import { EmptyState } from "@/components/music/empty-state";
import { PlaylistGrid } from "@/components/music/playlist-card";
import { SongList } from "@/components/music/song-list";
import { getSessionUser } from "@/lib/auth/guards";
import { listPlaylistsForUser } from "@/services/playlist.service";
import { listSongs } from "@/services/song.service";
import { songListQuerySchema } from "@/lib/validations/song";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await getSessionUser();
  const params = await searchParams;
  const term = (params.q ?? "").trim();

  const query = songListQuerySchema.parse({
    q: term || undefined,
    sort: params.sort ?? "newest",
    page: params.page,
    pageSize: 30,
    scope: "published",
  });

  if (!term) {
    return (
      <EmptyState
        title="Tìm kiếm bài nhạc"
        description="Nhập tên bài nhạc, nghệ sĩ hoặc thể loại vào ô tìm kiếm phía trên."
      />
    );
  }

  const [result, playlists] = await Promise.all([
    listSongs(query, { userId: user?.id }),
    listPlaylistsForUser(user?.id),
  ]);

  const matchedPlaylists = playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(term.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <SearchIcon className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">
            Kết quả cho “<span className="text-gradient">{term}</span>”
          </h1>
          <p className="text-sm text-muted-foreground">
            {result.total} bài nhạc · {matchedPlaylists.length} playlist
          </p>
        </div>
      </header>

      {result.total === 0 && matchedPlaylists.length === 0 ? (
        <EmptyState
          title="Không tìm thấy kết quả"
          description="Thử từ khoá khác, hoặc khám phá thư viện theo thể loại."
          action={
            <Link
              href="/music/discover"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Khám phá thư viện
            </Link>
          }
        />
      ) : null}

      {matchedPlaylists.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Playlist</h2>
          <PlaylistGrid playlists={matchedPlaylists} />
        </section>
      ) : null}

      {result.total > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Bài nhạc</h2>
          <SongList songs={result.items} label={`Kết quả tìm kiếm: ${term}`} />
        </section>
      ) : null}
    </div>
  );
}
