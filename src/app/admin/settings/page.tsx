import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdminPage } from "@/lib/auth/guards";

export default async function AdminSettingsPage() {
  await requireAdminPage();

  return <SettingsForm />;
}
