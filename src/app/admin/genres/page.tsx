import { GenreManager } from "@/components/admin/genre-manager";
import { requireAdminPage } from "@/lib/auth/guards";
import { listGenres } from "@/services/genre.service";

export default async function AdminGenresPage() {
  await requireAdminPage();
  const genres = await listGenres();

  return <GenreManager initialGenres={genres} />;
}
