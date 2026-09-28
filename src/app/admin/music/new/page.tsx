import { AddMusicForm } from "@/components/admin/add-music-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { listGenres } from "@/services/genre.service";

export default async function AdminNewMusicPage() {
  await requireAdminPage();
  const genres = await listGenres();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Thêm bài nhạc</h1>
        <p className="text-sm text-muted-foreground">
          Dán đường dẫn YouTube/SoundCloud/TikTok để lấy metadata chính thức, hoặc tải file nhạc
          lên hệ thống.
        </p>
      </header>

      <AddMusicForm genres={genres} />
    </div>
  );
}
