import { HistoryList } from "@/components/music/history-list";
import { requireUserPage } from "@/lib/auth/guards";
import { getUserListeningStats, listUserHistory } from "@/services/history.service";
import { formatListeningTime, formatNumber } from "@/lib/format";

export default async function MusicHistoryPage() {
  const user = await requireUserPage();

  const [entries, stats] = await Promise.all([
    listUserHistory(user.id, 100),
    getUserListeningStats(user.id),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Tổng lượt nghe</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.totalPlays)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Bài nhạc khác nhau</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.distinctSongs)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Thời lượng đã nghe</p>
          <p className="text-2xl font-semibold">
            {formatListeningTime(stats.totalMsPlayed / 1000)}
          </p>
        </div>
      </section>

      <HistoryList entries={entries} />
    </div>
  );
}
