import { requireAdmin } from "@/app/actions/admin-auth";
import { getAdminSessions } from "@/app/actions/admin-sessions";
import { AdminNav } from "../AdminNav";
import { AdminSessionsClient } from "./AdminSessionsClient";

export default async function AdminSessionsPage() {
  await requireAdmin();
  const data = await getAdminSessions();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/sessions" />
      <AdminSessionsClient initialSessions={data.sessions} users={data.users} />
    </div>
  );
}
