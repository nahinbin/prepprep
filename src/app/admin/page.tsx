import { requireAdmin } from "@/app/actions/admin-auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "./AdminNav";
import { Card } from "@/components/ui/Card";
import { Users, Gift, ShoppingBag, Coins } from "lucide-react";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [userCount, rewardCount, orderCount, pendingOrders] = await Promise.all([
    prisma.user.count(),
    prisma.reward.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
  ]);

  const stats = [
    { label: "Users", value: userCount, icon: Users, color: "text-primary border-primary/20" },
    { label: "Active Rewards", value: rewardCount, icon: Gift, color: "text-amber-500 border-amber-500/20" },
    { label: "Orders", value: orderCount, icon: ShoppingBag, color: "text-success border-success/20" },
    { label: "Pending", value: pendingOrders, icon: Coins, color: "text-danger border-danger/20" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className={`p-6 border ${color} flex flex-col items-center justify-center text-center`}>
            <Icon className={`w-8 h-8 mb-2 ${color.split(" ")[0]}`} />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-3xl font-black ${color.split(" ")[0]}`}>{value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
