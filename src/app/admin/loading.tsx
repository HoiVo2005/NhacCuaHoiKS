import { PageSkeleton } from "@/components/layout/page-skeleton";

/** Hien khung xuong ngay khi vao khu quan tri (tat ca trang con trong /admin) */
export default function AdminLoading() {
  return <PageSkeleton rows={4} />;
}
