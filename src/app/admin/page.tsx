import Link from "next/link";
import {
  BarChart3,
  Clock,
  Compass,
  FolderCog,
  History,
  ListMusic,
  PlusCircle,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";

import { HorizontalBars, PlaysLineChart, RankedList, SourceBreakdown } from "@/components/admin/charts";
import { PanelHeader, QuickLink, StatGrid, type StatCardData } from "@/components/admin/dashboard-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatListeningTime, formatNumber } from "@/lib/format";
import { getStatsOverview } from "@/services/stats.service";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const stats = await getStatsOverview();

  const plays14d = stats.playsByDay.reduce((sum, day) => sum + day.plays, 0);
  const peakDay = stats.playsByDay.reduce(
    (best, day) => (day.plays > best.plays ? day : best),
    { date: "", plays: 0 },
  );

  const statCards: StatCardData[] = [
    {
      label: "Tổng bài nhạc",
      value: formatNumber(stats.totalSongs),
      hint: `${stats.publishedSongs} đang phát hành`,
      icon: BarChart3,
      highlight: true,
    },
    {
      label: "Tổng lượt nghe",
      value: formatNumber(stats.totalPlays),
      hint: `${formatNumber(stats.playsToday)} lượt hôm nay`,
      icon: TrendingUp,
    },
    {
      label: "Người dùng",
      value: formatNumber(stats.totalUsers),
      hint: `${stats.activeUsers} đang hoạt động`,
      icon: Users,
    },
    {
      label: "Thời lượng nghe",
      value: formatListeningTime(stats.listeningHours * 3600),
      hint: `${formatNumber(stats.plays7d)} lượt trong 7 ngày`,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/*
        Tieu de trang + hanh dong nhanh.
        Tren dien thoai: xep DOC (tieu de truoc, 2 nut full-width). Truoc day de chung mot hang
        `justify-between` nen dong mo ta dai bi chay xuong duoi 2 nut roi bi cat.
      */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">Tổng quan hệ thống</h1>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate">
            Thống kê thư viện nhạc, lượt nghe và hoạt động của nhân viên
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
          <Button asChild size="sm" variant="gradient" className="h-10 w-full justify-center sm:h-9 sm:w-auto">
            <Link href="/admin/music/new">
              <PlusCircle /> Thêm bài nhạc
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-10 w-full justify-center sm:h-9 sm:w-auto">
            <Link href="/admin/employees">
              <Users /> Quản lý nhân viên
            </Link>
          </Button>
        </div>
      </header>

      <StatGrid stats={statCards} />

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={TrendingUp}
            title="Lượt nghe 14 ngày gần nhất"
            hint={`Tổng ${formatNumber(plays14d)} lượt · cao nhất ${formatNumber(peakDay.plays)} lượt/ngày`}
            aside={
              <Badge variant="secondary" className="tabular-nums">
                {formatNumber(stats.plays7d)} lượt / 7 ngày
              </Badge>
            }
          />
          <CardContent className="p-3.5 pt-3 sm:p-4">
            <PlaysLineChart data={stats.playsByDay} />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader
            icon={Compass}
            title="Tỉ lệ theo nguồn phát"
            hint={`${formatNumber(stats.totalSongs)} bài nhạc chia theo nền tảng`}
          />
          <CardContent className="p-3.5 sm:p-4">
            <SourceBreakdown items={stats.bySource} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="card-surface min-w-0">
          <PanelHeader icon={BarChart3} title="Bài nhạc nghe nhiều nhất" hint="Xếp theo tổng lượt nghe" />
          <CardContent className="p-3.5 sm:p-4">
            <RankedList
              unit=" lượt"
              emptyMessage="Chưa có bài nhạc nào được nghe."
              items={stats.topSongs.map((song) => ({
                id: song.id,
                label: song.title,
                hint: song.artist ?? undefined,
                value: song.playCount,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader icon={Tags} title="Thể loại được nghe nhiều" hint="Theo màu đã đặt cho thể loại" />
          <CardContent className="p-3.5 sm:p-4">
            <HorizontalBars
              unit=" lượt"
              items={stats.topGenres.map((genre) => ({
                label: genre.name,
                value: genre.plays,
                color: genre.color,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="card-surface min-w-0">
          <PanelHeader icon={Users} title="Nhân viên nghe nhiều nhất" hint="Năm tài khoản dẫn đầu" />
          <CardContent className="p-3.5 sm:p-4">
            <RankedList
              unit=" lượt"
              emptyMessage="Chưa có dữ liệu nghe nhạc."
              items={stats.topListeners.map((listener) => ({
                id: listener.id,
                label: listener.name,
                hint: formatListeningTime(listener.msPlayed / 1000),
                value: listener.plays,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-2.5 sm:grid-cols-3 sm:gap-3" aria-label="Lối tắt quản trị">
        <QuickLink
          href="/admin/music"
          icon={ListMusic}
          title="Quản lý thư viện nhạc"
          description="Sửa thông tin, ẩn/hiện hoặc xoá bài nhạc"
        />
        <QuickLink
          href="/admin/playlists"
          icon={FolderCog}
          title="Playlist nội bộ"
          description="Playlist dùng chung cho toàn công ty"
          tone="text-brand-sky"
        />
        <QuickLink
          href="/admin/history"
          icon={History}
          title="Lịch sử nghe toàn hệ thống"
          description="Theo dõi hoạt động nghe nhạc của nhân viên"
          tone="text-warning"
        />
      </section>
    </div>
  );
}
