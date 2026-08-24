import { requireAdmin } from "@/app/actions/admin-auth";
import { getAdminUsers } from "@/app/actions/rewards";
import { AdminNav } from "../AdminNav";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAdminUsers();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/users" />
      <AdminUsersClient users={users} />
    </div>
  );
}
