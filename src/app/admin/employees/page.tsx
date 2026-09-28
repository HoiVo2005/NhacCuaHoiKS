import { EmployeeManager } from "@/components/admin/employee-manager";
import { requireAdminPage } from "@/lib/auth/guards";
import { listUsers } from "@/services/user.service";

export default async function AdminEmployeesPage() {
  await requireAdminPage();
  const users = await listUsers();

  return <EmployeeManager initialUsers={users} />;
}
