/**
 * Lam sach ten bai TRUOC KHI tra cuu loi (LRCLIB).
 *
 * Tach rieng khoi `lyrics-match.ts` de ca hai noi cung dung mot luat, va de service tra cuu
 * import ma khong tao vong lap module.
 */

/** Cac tu khoa "nhieu" trong ten bai. Khong bo Remix/Live/Karaoke vi loi cua chung KHAC ban goc. */
export const TITLE_NOISE =
  /\b(official\s*(music\s*)?(video|audio|mv)|lyric\s*video|lyrics?|visuali[sz]er|m\/?v|audio|hd|4k)\b/i;

/**
 * Bo cac phan "nhieu" trong ten bai khi tra cuu loi:
 *  - phan trong ngoac: `(Official Video)`, `[MV]`, `(Audio)`, `(HD)`...
 *  - cac doan sau dau `|` (kieu dat ten tren YouTube: `... | Official Music Video | May Saigon`),
 *  - hau to `- Topic`.
 * Ban GOC cua ten bai van duoc thu sau do (xem `titleCandidates`) nen khong so mat truong hop dung.
 */
export function stripTitleNoise(title: string): string {
  const withoutBrackets = title.replace(/[([][^)\]]*[)\]]/g, (segment) =>
    TITLE_NOISE.test(segment) ? "" : segment,
  );

  const segments = withoutBrackets.split("|").map((segment) => segment.trim());
  const kept = segments.filter((segment, index) => index === 0 || !TITLE_NOISE.test(segment));

  return kept
    .join(" | ")
    .replace(/\s*-\s*topic\s*$/i, " ")
    .replace(/\s{2,}/g, " ")
    /* Bo dau `|` con lai o cuoi khi doan sau da bi loc het */
    .replace(/(\s*\|\s*)+$/, "")
    .trim();
}
