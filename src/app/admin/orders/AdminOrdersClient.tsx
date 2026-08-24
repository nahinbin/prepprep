"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateOrderStatus } from "@/app/actions/rewards";

type Order = {
  id: string;
  coinCost: number;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  status: string;
  createdAt: Date | string;
  user: { id: string; username: string };
  reward: { id: string; name: string; image: string };
};

export function AdminOrdersClient({ orders }: { orders: Order[] }) {
  const router = useRouter();

  const setStatus = async (id: string, status: string) => {
    await updateOrderStatus(id, status);
    router.refresh();
  };

  if (orders.length === 0) {
    return (
      <Card className="w-full max-w-5xl p-12 text-center text-muted-foreground rounded-2xl">
        <p className="text-lg font-bold">No orders yet</p>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      {orders.map((o) => (
        <Card key={o.id} className="p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted shrink-0">
              <img src={o.reward.image} alt={o.reward.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{o.reward.name}</h3>
                <span className="px-3 py-1 rounded-2xl text-sm font-bold bg-primary/10 text-primary capitalize">
                  {o.status}
                </span>
              </div>
              <p className="text-amber-500 font-black">{o.coinCost} coins</p>
              <p className="text-sm">
                <span className="text-muted-foreground">User:</span>{" "}
                <span className="font-bold">{o.user.username}</span>
              </p>
              <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p>
                  <span className="font-semibold text-foreground">{o.fullName}</span> · {o.phone}
                </p>
                <p>
                  {o.address}, {o.city}, {o.country}
                </p>
                <p>{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {o.status !== "shipped" && (
                  <Button size="sm" className="rounded-2xl" onClick={() => setStatus(o.id, "shipped")}>
                    Mark Shipped
                  </Button>
                )}
                {o.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setStatus(o.id, "completed")}
                  >
                    Complete
                  </Button>
                )}
                {o.status !== "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-2xl"
                    onClick={() => setStatus(o.id, "pending")}
                  >
                    Pending
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
