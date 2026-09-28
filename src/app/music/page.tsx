import Link from "next/link";
import { Clock, Flame, Heart, Library, ListMusic, LogIn, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand/logo";
import { EmptyState } from "@/components/music/empty-state";
import { HeroHighlight } from "@/components/music/hero-highlight";
import { PlaylistGrid } from "@/components/music/playlist-card";
import { SectionHeader } from "@/components/music/section-header";
import { SongGrid } from "@/components/music/song-card";
import { SongList } from "@/components/music/song-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/guards";
import { APP_NAME } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { countUniqueSongs } from "@/lib/music/collections";
import { listRecentlyPlayedSongs } from "@/services/history.service";
import { listFeaturedPlaylists } from "@/services/playlist.service";
import { listNewestSongs, listTopSongs } from "@/services/song-discovery.service";

/** Trang chu nghe nhac: khach (chua dang nhap) van xem va nghe duoc */
export default async function MusicHomePage() {
  const user = await getSessionUser();

  const [newest, top, featured, recentEntries] = await Promise.all([
    listNewestSongs(8, user?.id),
    listTopSongs(6, user?.id),
    listFeaturedPlaylists(4),
    // "Nghe tiếp": mỗi bài chỉ hiện MỘT lần dù đã nghe lại nhiều lần
    user ? listRecentlyPlayedSongs(user.id, 6) : Promise.resolve([]),
  ]);

  const recentlyPlayed = recentEntries.map((entry) => entry.song);
  // "Nhạc mới" và "Nghe nhiều nhất" có thể chứa cùng một bài -> đếm theo id để không đếm trùng
  const highlightedCount = countUniqueSongs(newest, top);

  // Bài "nổi bật": ưu tiên bài nghe nhiều nhất, nếu thư viện mới thì lấy bài mới thêm
  const highlight = top[0] ?? newest[0] ?? null;

  return (
    <div className="space-y-9">
      {/* ------------------------------------------------------------------ Hero
          Nền hero là mesh gradient + lưới mờ dựng bằng token màu chủ đạo (không cần ảnh ngoài).
          Cột phải là thẻ "phát nhanh" bài nổi bật -> vào trang là nghe được ngay. */}
      <section className="hero-mesh animate-fade-up relative overflow-hidden rounded-3xl border border-border/70 shadow-soft">
        {/* Watermark logo thương hiệu (chỉ là hình nền trang trí) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 rotate-12 opacity-[0.07]"
        >
          <BrandMark className="size-40 rounded-[2rem] sm:size-56 sm:rounded-[2.5rem]" />
        </div>

        <div className="relative grid gap-5 p-4 sm:gap-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/*
            min-w-0: mac dinh cua grid/flex item la `min-width: auto` (= min-content cua con),
            nen mot hang con rong (vi du 2 nut CTA canh nhau) se keo ca cot rong hon khung
            -> noi dung bi `overflow-hidden` cua hero cat cut tren dien thoai.
          */}
          <div className="min-w-0 space-y-4">
            <Badge variant="neon" className="w-fit gap-1">
              <Sparkles className="size-3" /> Thư viện nội bộ
            </Badge>

            <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
              {user ? (
                <>
                  Xin chào <span className="text-gradient">{user.name}</span>
                </>
              ) : (
                <>
                  Chào mừng bạn đến với <span className="text-gradient">{APP_NAME}</span>
                </>
              )}
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {user
                ? `Tổng hợp ${formatNumber(highlightedCount)} bài nhạc nổi bật đang chờ bạn. Bấm vào bất kỳ bài nào để phát — nhạc sẽ tiếp tục phát khi bạn chuyển trang.`
                : "Bạn có thể nghe nhạc ngay mà không cần đăng nhập. Đăng nhập để lưu bài yêu thích, tạo playlist riêng và xem lại lịch sử nghe."}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                asChild
                variant="gradient"
                className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
              >
                <Link href="/music/discover">
                  <Library /> Khám phá thư viện
                </Link>
              </Button>
              {user ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                >
                  <Link href="/music/history">
                    <Clock /> Nhạc vừa nghe
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                >
                  <Link href="/login">
                    <LogIn /> Đăng nhập để lưu nhạc
                  </Link>
                </Button>
              )}
            </div>

            {/* Chip số liệu: thông tin nhanh về thư viện */}
            <div className="flex flex-wrap gap-2 pt-2">
              <StatChip icon={Sparkles} value={formatNumber(highlightedCount)} label="bài nổi bật" />
              {featured.length > 0 ? (
                <StatChip
                  icon={ListMusic}
                  value={formatNumber(featured.length)}
                  label="playlist nội bộ"
                />
              ) : null}
              {newest.length > 0 ? (
                <StatChip icon={Library} value={formatNumber(newest.length)} label="bài mới thêm" />
              ) : null}
              {user && recentlyPlayed.length > 0 ? (
                <StatChip
                  icon={Heart}
                  value={formatNumber(recentlyPlayed.length)}
                  label="bài vừa nghe"
                />
              ) : null}
            </div>
          </div>

          {/* Thẻ phát nhanh: chỉ hiện khi thư viện có bài */}
          {highlight ? (
            <div className="w-full min-w-0 lg:max-w-md lg:justify-self-end">
              <HeroHighlight song={highlight} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Nghe tiep */}
      {recentlyPlayed.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            title="Nghe tiếp"
            hint="Tiếp tục những bài bạn đang nghe dở"
            icon={Clock}
            href="/music/history"
            ariaLabel="Xem tất cả lịch sử nghe"
          />
          <SongList songs={recentlyPlayed} label="Nghe tiếp" showHeader={false} />
        </section>
      ) : null}

      {/* Playlist noi bo */}
      {featured.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            title="Playlist nổi bật"
            hint="Danh sách phát được chia sẻ cho toàn công ty"
            icon={Sparkles}
            href="/music/playlists"
            ariaLabel="Xem tất cả playlist nổi bật"
          />
          <PlaylistGrid playlists={featured} />
        </section>
      ) : null}

      {/* Nhac moi */}
      <section className="space-y-3">
        <SectionHeader
          title="Mới thêm vào thư viện"
          hint="Những bài nhạc vừa được đưa lên hệ thống"
          icon={Library}
          href="/music/discover"
          ariaLabel="Xem tất cả bài nhạc mới"
        />
        {newest.length === 0 ? (
          <EmptyState
            title="Thư viện đang trống"
            description="Quản trị viên chưa thêm bài nhạc nào vào hệ thống."
          />
        ) : (
          <SongGrid songs={newest} queueLabel="Mới thêm vào thư viện" />
        )}
      </section>

      {/* Nghe nhieu nhat */}
      <section className="space-y-3">
        <SectionHeader
          title="Nghe nhiều nhất"
          hint="Xếp hạng theo số lượt nghe trong hệ thống"
          icon={Flame}
          href="/music/discover?sort=plays"
          ariaLabel="Xem tất cả bài nghe nhiều nhất"
        />
        <SongList songs={top} label="Nghe nhiều nhất" showHeader={false} />
      </section>
    </div>
  );
}

/** Chip số liệu nhỏ trên hero (kiểu "stat pill" của các dashboard nhạc) */
function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <span className="chip-glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-soft">
      <Icon className="size-3.5 text-primary" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
