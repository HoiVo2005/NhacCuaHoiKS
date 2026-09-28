import { PageSkeleton } from "@/components/layout/page-skeleton";

/** Hien khung xuong ngay khi vao khu nghe nhac (tat ca trang con trong /music) */
export default function MusicLoading() {
  return <PageSkeleton rows={8} />;
}
