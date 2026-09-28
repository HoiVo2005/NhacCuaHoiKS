import { notFound } from "next/navigation";

import { PlaylistDetailView } from "@/components/music/playlist-detail-view";
import { getSessionUser } from "@/lib/auth/guards";
import { isServiceError } from "@/lib/api/errors";
import { getPlaylist } from "@/services/playlist.service";
import type { PlaylistDetailDTO } from "@/types";

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlaylistDetailPage({ params }: PlaylistPageProps) {
  const user = await getSessionUser();
  const { id } = await params;

  let playlist: PlaylistDetailDTO | null = null;
  let forbiddenMessage: string | null = null;

  // Khong tao JSX trong try/catch: chi xu ly du lieu, phan render nam ngoai
  try {
    playlist = await getPlaylist(id, {
      userId: user?.id ?? "",
      allowAdmin: user?.role === "ADMIN",
    });
  } catch (error) {
    if (isServiceError(error) && error.status === 403) {
      forbiddenMessage = "Bạn không có quyền xem playlist này.";
    } else {
      throw error;
    }
  }

  if (forbiddenMessage) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        {forbiddenMessage}
      </div>
    );
  }

  if (!playlist) {
    notFound();
  }

  return (
    <PlaylistDetailView
      playlist={playlist}
      isOwner={playlist.ownerId === user?.id || user?.role === "ADMIN"}
    />
  );
}
