"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { useSessionUser } from "@/components/auth/session-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  songId: string;
  initialFavorite?: boolean;
  size?: "icon-sm" | "icon" | "icon-lg";
  className?: string;
}

export function FavoriteButton({
  songId,
  initialFavorite = false,
  size = "icon-sm",
  className,
}: FavoriteButtonProps) {
  // Trang thai hien thi = gia tri do nguoi dung thay doi (neu co) hoac gia tri tu server
  const [override, setOverride] = useState<boolean | null>(null);
  const [trackedSongId, setTrackedSongId] = useState(songId);
  const [pending, setPending] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useSessionUser();

  // Khi doi bai nhac khac: cap nhat trang thai ngay trong luc render (khong dung useEffect)
  if (trackedSongId !== songId) {
    setTrackedSongId(songId);
    setOverride(null);
  }

  const isFavorite = override ?? initialFavorite;

  async function toggleFavorite() {
    if (!isAuthenticated) {
      toast.info("Đăng nhập để lưu bài nhạc yêu thích nhé!");
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (pending) return;
    setPending(true);

    const nextValue = !isFavorite;
    setOverride(nextValue);

    try {
      const response = await fetch(`/api/songs/${songId}/favorite`, { method: "POST" });
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { isFavorite: boolean };
      setOverride(data.isFavorite);
      toast.success(data.isFavorite ? "Đã thêm vào yêu thích" : "Đã bỏ khỏi yêu thích");
    } catch {
      setOverride(!nextValue);
      toast.error("Không cập nhật được yêu thích. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleFavorite}
      disabled={pending}
      className={cn(isFavorite && "text-rose-500 dark:text-rose-400", className)}
      title={isFavorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
    >
      <Heart className={cn(isFavorite && "fill-current")} />
    </Button>
  );
}
