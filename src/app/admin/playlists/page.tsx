import { AdminPlaylistManager } from "@/components/admin/admin-playlist-manager";
import { requireAdminPage } from "@/lib/auth/guards";
import { listAllPlaylists } from "@/services/playlist.service";

export default async function AdminPlaylistsPage() {
  await requireAdminPage();
  const playlists = await listAllPlaylists();

  return <AdminPlaylistManager initialPlaylists={playlists} />;
}
