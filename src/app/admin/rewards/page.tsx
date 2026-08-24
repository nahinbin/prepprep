import { requireAdmin } from "@/app/actions/admin-auth";
import { getAdminRewards } from "@/app/actions/rewards";
import { AdminNav } from "../AdminNav";
import { AdminRewardsClient } from "./AdminRewardsClient";

export default async function AdminRewardsPage() {
  await requireAdmin();
  const rewards = await getAdminRewards();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/rewards" />
      <AdminRewardsClient rewards={rewards} />
    </div>
  );
}
