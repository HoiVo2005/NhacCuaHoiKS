import Link from "next/link";
import { Compass } from "lucide-react";

import { SongGrid } from "@/components/music/song-card";
import { SongList } from "@/components/music/song-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/guards";
import { SOURCE_LABELS, SOURCE_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { listGenres } from "@/services/genre.service";
import { listSongs } from "@/services/song.service";
import { songListQuerySchema } from "@/lib/validations/song";
import type { SourceType } from "@/types";

interface DiscoverPageProps {
  searchParams: Promise<{ genre?: string; source?: string; sort?: string; page?: string }>;
}

const SORTS = [
  { value: "newest", label: "Mới nhất" },
  { value: "plays", label: "Nghe nhiều" },
  { value: "title", label: "Tên A-Z" },
] as const;

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const user = await getSessionUser();
  const params = await searchParams;

  const query = songListQuerySchema.parse({
    genre: params.genre,
    source: params.source,
    sort: params.sort,
    page: params.page,
    pageSize: 24,
    scope: "published",
  });

  const [genres, result] = await Promise.all([
    listGenres(),
    listSongs(query, { userId: user?.id }),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      genre: params.genre,
      source: params.source,
      sort: params.sort,
      ...overrides,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }

    const search = next.toString();
    return `/music/discover${search ? `?${search}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Compass className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Khám phá thư viện</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} bài nhạc · lọc theo thể loại, nguồn phát và thứ tự
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={params.genre ? "outline" : "gradient"}
            className="rounded-full"
          >
            <Link href={buildHref({ genre: undefined, page: undefined })}>Tất cả thể loại</Link>
          </Button>
          {genres.map((genre) => (
            <Button
              key={genre.id}
              asChild
              size="sm"
              variant={params.genre === genre.slug ? "gradient" : "outline"}
              className="rounded-full"
            >
              <Link href={buildHref({ genre: genre.slug, page: undefined })}>
                {genre.name}
                {typeof genre.songCount === "number" ? ` (${genre.songCount})` : ""}
              </Link>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={params.source ? "outline" : "secondary"}
            className="rounded-full"
          >
            <Link href={buildHref({ source: undefined, page: undefined })}>Mọi nguồn</Link>
          </Button>
          {(Object.keys(SOURCE_TYPES) as SourceType[]).map((source) => (
            <Button
              key={source}
              asChild
              size="sm"
              variant={params.source === source ? "secondary" : "ghost"}
              className={cn("rounded-full", params.source === source && "text-primary")}
            >
              <Link href={buildHref({ source, page: undefined })}>{SOURCE_LABELS[source]}</Link>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map((sort) => (
            <Button
              key={sort.value}
              asChild
              size="sm"
              variant={query.sort === sort.value ? "default" : "ghost"}
              className="rounded-full"
            >
              <Link href={buildHref({ sort: sort.value, page: undefined })}>{sort.label}</Link>
            </Button>
          ))}
          {params.genre ? (
            <Badge variant="secondary">Thể loại: {params.genre}</Badge>
          ) : null}
        </div>
      </section>

      {query.sort === "title" ? (
        <SongList
          songs={result.items}
          label="Thư viện nhạc"
          emptyMessage="Không có bài nhạc nào khớp bộ lọc."
        />
      ) : (
        <SongGrid
          songs={result.items}
          queueLabel="Thư viện nhạc"
          emptyMessage="Không có bài nhạc nào khớp bộ lọc."
        />
      )}

      {result.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
            className={cn(result.page <= 1 && "pointer-events-none opacity-50")}
          >
            <Link href={buildHref({ page: String(result.page - 1) })}>Trang trước</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Trang {result.page}/{result.totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(result.page >= result.totalPages && "pointer-events-none opacity-50")}
          >
            <Link href={buildHref({ page: String(result.page + 1) })}>Trang sau</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
