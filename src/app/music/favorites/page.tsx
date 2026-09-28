import { Heart } from "lucide-react";

import { EmptyState } from "@/components/music/empty-state";
import { SongList } from "@/components/music/song-list";
import { requireUserPage } from "@/lib/auth/guards";
import { listFavoriteSongs } from "@/services/favorite.service";

export default async function FavoritesPage() {
  const user = await requireUserPage();
  const songs = await listFavoriteSongs(user.id);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        {/* Trai tim mau hong (tach khoi mau chu dao xanh) */}
        <Heart className="size-5 text-rose-500 dark:text-rose-400" />
        <div>
          <h1 className="text-xl font-semibold">Bài nhạc yêu thích</h1>
          <p className="text-sm text-muted-foreground">{songs.length} bài nhạc đã lưu</p>
        </div>
      </header>

      {songs.length === 0 ? (
        <EmptyState
          title="Chưa có bài nhạc yêu thích"
          description="Bấm biểu tượng trái tim ở bất kỳ bài nhạc nào để lưu vào đây."
        />
      ) : (
        <SongList songs={songs} label="Bài nhạc yêu thích" />
      )}
    </div>
  );
}
