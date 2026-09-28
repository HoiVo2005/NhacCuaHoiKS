/**
 * Tien ich gop danh sach bai nhac (chi can truong `id`).
 * Dung cho con so tong ket tren giao dien: mot bai co the nam trong nhieu
 * danh sach khac nhau (vi du "nhac moi" va "nghe nhieu nhat") nen neu cong
 * thang so luong thi con so se bi doi len.
 */

/** So bai nhac KHONG trung lap khi gop nhieu danh sach (so sanh theo `id`) */
export function countUniqueSongs(...lists: ReadonlyArray<ReadonlyArray<{ id: string }>>): number {
  const ids = new Set<string>();

  for (const list of lists) {
    for (const song of list) {
      if (song?.id) ids.add(song.id);
    }
  }

  return ids.size;
}
