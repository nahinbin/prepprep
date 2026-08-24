import { requireAdmin } from "@/app/actions/admin-auth";
import { getEconomySettings, ensureAppSettings } from "@/app/actions/settings";
import { AdminNav } from "../AdminNav";
import { AdminSettingsClient } from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  await requireAdmin();
  await ensureAppSettings();
  const settings = await getEconomySettings();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/settings" />
      <AdminSettingsClient initial={settings} />
    </div>
  );
}
