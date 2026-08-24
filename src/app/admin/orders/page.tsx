import { requireAdmin } from "@/app/actions/admin-auth";
import { getAdminOrders } from "@/app/actions/rewards";
import { AdminNav } from "../AdminNav";
import { AdminOrdersClient } from "./AdminOrdersClient";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await getAdminOrders();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/orders" />
      <AdminOrdersClient orders={orders} />
    </div>
  );
}
