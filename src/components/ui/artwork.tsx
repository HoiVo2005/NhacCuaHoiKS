"use client";

import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

import { thumbnailFallbackUrls } from "@/lib/music/thumbnails";
import { cn } from "@/lib/utils";

type ArtworkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** URL bia bai nhac (co the la URL YouTube/SoundCloud chat luong thap - se tu nang cap) */
  src: string | null | undefined;
  /**
   * Hien khi khong co anh, hoac moi co anh cua nguon deu tai loi.
   * Mac dinh: khung ♪ dung lai `className` cua anh nen kich thuoc/bo goc khong doi.
   */
  fallback?: ReactNode;
};

/**
 * Anh bia co tu ha cap chat luong.
 *
 * Van de da gap: bai nhac luu URL bia chat luong thap (`hqdefault.jpg` 480x360, co vien den)
 * nen khi hien thi o khung lon, anh bi keo gian -> MO. Component nay:
 *  1. Xin ban net nhat truoc (`thumbnailFallbackUrls` - vd `maxresdefault.jpg` 1280x720).
 *  2. Ban net nhat khong ton tai (video cu / video doc) thi tu thu ban thap hon - khong bao gio
 *     de lai o anh vo, cung khong bao gio hien nham anh cua bai khac.
 *  3. Doi bai (URL goc doi) thi bo nho "da loi" duoc dat lai -> bai moi van thu tu ban net nhat.
 *
 * LUU Y: phai la client component vi can `onError`; anh dung the `<img>` thuong (khong dung
 * `next/image`) de giu nguyen hanh vi lazy-load va CSS `.art-frame img` (zoom khi hover the).
 */
export function Artwork({ src, alt = "", fallback, loading = "lazy", className, ...rest }: ArtworkProps) {
  const source = (src ?? "").trim();
  const candidates = thumbnailFallbackUrls(source);

  /**
   * So lan tai loi, GAN voi URL goc: nhieu cho (thanh phat, trinh phat day du) dung lai cung mot
   * component cho nhieu bai nen neu chi luu con so thi bai moi se bi bat dau tu ban da ha cap.
   */
  const [failure, setFailure] = useState<{ source: string; count: number }>({ source, count: 0 });
  const attempt = failure.source === source ? failure.count : 0;
  const current = candidates[attempt];

  if (!current) {
    return (
      <>
        {fallback ?? (
          <span
            className={cn(
              "flex items-center justify-center bg-surface text-xs text-muted-foreground",
              className,
            )}
          >
            ♪
          </span>
        )}
      </>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailure({ source, count: attempt + 1 })}
      {...rest}
    />
  );
}
