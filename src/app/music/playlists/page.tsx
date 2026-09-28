import { PlaylistManager } from "@/components/music/playlist-manager";
import { requireUserPage } from "@/lib/auth/guards";
import { listOwnedPlaylists, listPlaylistsForUser } from "@/services/playlist.service";

export default async function MusicPlaylistsPage() {
  const user = await requireUserPage();

  const [owned, shared] = await Promise.all([
    listOwnedPlaylists(user.id),
    listPlaylistsForUser(user.id),
  ]);

  const sharedByOthers = shared.filter((playlist) => playlist.ownerId !== user.id);

  return (
    <div className="space-y-8">
      <PlaylistManager initialPlaylists={owned} />

      {sharedByOthers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Playlist được chia sẻ</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sharedByOthers.map((playlist) => (
              <a
                key={playlist.id}
                href={`/music/playlists/${playlist.id}`}
                className="rounded-xl border border-border/70 bg-card/50 p-4 transition hover:border-primary/40"
              >
                <p className="truncate text-sm font-medium">{playlist.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {playlist.songCount} bài · chủ sở hữu {playlist.ownerName}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
