import { DeviceManager } from "@/components/auth/device-manager";
import { ProfileForm } from "@/components/auth/profile-form";
import { requireUserPage } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { countFavorites } from "@/services/favorite.service";
import { getUserListeningStats } from "@/services/history.service";
import { countPlaylistsByOwner } from "@/services/playlist.service";
import { formatNumber } from "@/lib/format";

export default async function ProfilePage() {
  const user = await requireUserPage();

  const [record, favorites, playlistCount, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, lastLoginAt: true },
    }),
    countFavorites(user.id),
    countPlaylistsByOwner(user.id),
    getUserListeningStats(user.id),
  ]);

  return (
    <div className="space-y-6">
      <ProfileForm
        user={user}
        createdAt={record?.createdAt ? record.createdAt.toISOString() : undefined}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Lượt nghe</p>
          <p className="text-2xl font-semibold">{formatNumber(stats.totalPlays)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Bài nhạc yêu thích</p>
          <p className="text-2xl font-semibold">{formatNumber(favorites)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Playlist cá nhân</p>
          <p className="text-2xl font-semibold">{formatNumber(playlistCount)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Đăng nhập gần nhất</p>
          <p className="text-sm font-medium">
            {record?.lastLoginAt ? record.lastLoginAt.toLocaleString("vi-VN") : "—"}
          </p>
        </div>
      </section>

      {/* Thiết bị đang đăng nhập: IP, tên máy, vị trí + đăng xuất / chặn đăng nhập từng thiết bị */}
      <DeviceManager />
    </div>
  );
}
