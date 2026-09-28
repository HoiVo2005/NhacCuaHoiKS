import Link from "next/link";
import { Activity, Clock, Compass, Flame, Music4, Sparkles, Tags, TrendingUp } from "lucide-react";

import { HorizontalBars, PlaysLineChart, RankedList, SourceBreakdown } from "@/components/admin/charts";
import { PanelHeader, StatGrid, type StatCardData } from "@/components/admin/dashboard-cards";
import { EmptyState } from "@/components/music/empty-state";
import { SongList } from "@/components/music/song-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUserPage } from "@/lib/auth/guards";
import { formatDateTime, formatDateOnly, formatListeningTime, formatNumber } from "@/lib/format";
import { getListeningInsights, INSIGHTS_TREND_DAYS } from "@/services/history.service";

/**
 * "Nhịp nghe" - thống kê thói quen nghe nhạc của từng nhân viên.
 *
 * Dùng lại component của dashboard quản trị (`StatGrid`, `PanelHeader`, `PlaysLineChart`,
 * `RankedList`, `HorizontalBars`, `SourceBreakdown`) nên số liệu cá nhân và số liệu hệ thống
 * nhìn cùng một ngôn ngữ thiết kế, không phải vẽ lại biểu đồ mới.
 */
export default async function MusicStatsPage() {
  const user = await requireUserPage();
  const insights = await getListeningInsights(user.id);

  const trendPlays = insights.dailyTrend.reduce((total, day) => total + day.plays, 0);
  const busiestDay = insights.dailyTrend.reduce(
    (best, day) => (day.plays > best.plays ? day : best),
    { date: "", plays: 0 },
  );

  if (insights.totalPlays === 0) {
    return (
      <div className="space-y-5">
        <header className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">Nhịp nghe của bạn</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Thói quen nghe nhạc, giờ vàng và những bài bạn nghe nhiều nhất
          </p>
        </header>

        <EmptyState
          title="Chưa có lượt nghe nào"
          description="Bắt đầu nghe một bài nhạc bất kỳ — biểu đồ nhịp nghe, giờ vàng và chuỗi ngày liên tiếp sẽ xuất hiện ở đây."
          action={
            <Button asChild size="sm" variant="gradient" className="rounded-full">
              <Link href="/music/discover">
                <Compass /> Khám phá thư viện
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const statCards: StatCardData[] = [
    {
      label: "Tổng lượt nghe",
      value: formatNumber(insights.totalPlays),
      hint: `${formatNumber(trendPlays)} lượt trong ${INSIGHTS_TREND_DAYS} ngày`,
      icon: Activity,
      highlight: true,
    },
    {
      label: "Thời lượng đã nghe",
      value: formatListeningTime(insights.totalMsPlayed / 1000),
      hint: insights.peakHour ? `Giờ vàng ${insights.peakHour.label}` : "Chưa đủ dữ liệu về giờ",
      icon: Clock,
    },
    {
      label: "Bài nhạc khác nhau",
      value: formatNumber(insights.distinctSongs),
      hint: `${formatNumber(insights.topArtists.length)} nghệ sĩ trong ${insights.windowDays} ngày`,
      icon: Music4,
    },
    {
      label: "Chuỗi ngày liên tiếp",
      value: `${formatNumber(insights.streak.current)} ngày`,
      hint: insights.streak.listenedToday ? "Hôm nay đã nghe" : "Hôm nay chưa nghe",
      icon: Flame,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">Nhịp nghe của bạn</h1>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate">
            Thói quen nghe nhạc, giờ vàng và những bài bạn nghe nhiều nhất
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
          <Button asChild size="sm" variant="gradient" className="h-10 w-full justify-center sm:h-9 sm:w-auto">
            <Link href="/music/discover">
              <Compass /> Khám phá thêm
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-10 w-full justify-center sm:h-9 sm:w-auto">
            <Link href="/music/history">
              <Clock /> Lịch sử nghe
            </Link>
          </Button>
        </div>
      </header>

      {/* Chuỗi ngày: động lực để quay lại nghe mỗi ngày */}
      <Card className="card-surface min-w-0">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3.5 sm:p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-soft">
            <Flame className="size-5" />
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Chuỗi ngày liên tiếp
            </p>
            <p className="text-xl font-semibold tabular-nums sm:text-2xl">
              {formatNumber(insights.streak.current)} ngày
              {insights.streak.longest > insights.streak.current ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · kỷ lục {formatNumber(insights.streak.longest)} ngày
                </span>
              ) : null}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {insights.streak.listenedToday
                ? "Hôm nay bạn đã nghe nhạc — chuỗi vẫn đang giữ."
                : "Hôm nay chưa nghe bài nào: mở một bài để giữ chuỗi."}
            </p>
            {insights.firstPlayedAt ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Nghe nhạc từ {formatDateTime(insights.firstPlayedAt)}
              </p>
            ) : null}
          </div>

          {insights.peakHour ? (
            <Badge variant="secondary" className="shrink-0">
              <Sparkles className="size-3" /> Giờ vàng {insights.peakHour.label}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <StatGrid stats={statCards} />

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={TrendingUp}
            title={`Nhịp nghe ${INSIGHTS_TREND_DAYS} ngày gần nhất`}
            hint={
              busiestDay.plays > 0
                ? `Tổng ${formatNumber(trendPlays)} lượt · ngày đông nhất ${formatDateOnly(busiestDay.date)} (${formatNumber(busiestDay.plays)} lượt)`
                : "Chưa có lượt nghe trong khoảng này"
            }
            aside={
              <Badge variant="secondary" className="tabular-nums">
                {formatNumber(insights.totalPlays)} lượt tổng cộng
              </Badge>
            }
          />
          <CardContent className="p-3.5 pt-3 sm:p-4">
            <PlaysLineChart data={insights.dailyTrend} />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={Compass}
            title="Nguồn phát bạn nghe"
            hint={`Theo ${insights.windowDays} ngày gần nhất`}
          />
          <CardContent className="p-3.5 sm:p-4">
            <SourceBreakdown items={insights.bySource} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={Clock}
            title="Giờ bạn hay nghe nhất"
            hint="Gom theo khung 3 giờ (giờ địa phương của bạn)"
          />
          <CardContent className="p-3.5 sm:p-4">
            <RankedList
              unit=" lượt"
              emptyMessage="Chưa có lượt nghe nào để thống kê theo giờ."
              items={insights.hourBuckets.map((bucket) => ({
                id: bucket.label,
                label: bucket.label,
                value: bucket.plays,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={Activity}
            title="Nghệ sĩ bạn nghe nhiều"
            hint={`Trong ${insights.windowDays} ngày gần nhất`}
          />
          <CardContent className="p-3.5 sm:p-4">
            <RankedList
              unit=" lượt"
              emptyMessage="Chưa có dữ liệu."
              items={insights.topArtists.map((artist) => ({
                id: artist.name,
                label: artist.name,
                hint: formatListeningTime(artist.msPlayed / 1000),
                value: artist.plays,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader icon={Tags} title="Thể loại bạn nghe nhiều" hint="Theo màu đã đặt cho thể loại" />
          <CardContent className="p-3.5 sm:p-4">
            <HorizontalBars
              unit=" lượt"
              items={insights.topGenres.map((genre) => ({
                label: genre.name,
                value: genre.plays,
                color: genre.color,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <PanelHeader
          icon={Music4}
          title="Bài nhạc của bạn nghe nhiều nhất"
          hint={`Top 8 bài trong ${insights.windowDays} ngày gần nhất — bấm để nghe lại`}
        />
        <SongList
          songs={insights.topSongs.map((entry) => entry.song)}
          label="Bài nghe nhiều nhất của bạn"
          emptyMessage="Chưa có bài nhạc nào được nghe."
        />
      </section>
    </div>
  );
}
