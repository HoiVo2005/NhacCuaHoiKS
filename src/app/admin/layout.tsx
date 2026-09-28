import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireAdminPage } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={user.role} userName={user.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} />

        <div className="pt-12 lg:pt-0">
          <Topbar user={user} />
          <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-44 pt-4 sm:px-6 sm:pb-32 sm:pt-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
