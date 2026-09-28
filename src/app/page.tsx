import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/guards";

/**
 * Trang goc: khach vao thang trang nghe nhac, khong bat buoc dang nhap.
 */
export default async function RootPage() {
  const user = await getSessionUser();

  if (user?.role === "ADMIN") {
    redirect("/admin");
  }

  redirect("/music");
}
