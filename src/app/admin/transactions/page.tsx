import { requireAdmin } from "@/app/actions/admin-auth";
import { getAdminTransactions } from "@/app/actions/admin-users";
import { AdminNav } from "../AdminNav";
import { Card } from "@/components/ui/Card";
import { Coins } from "lucide-react";

export default async function AdminTransactionsPage() {
  await requireAdmin();
  const txs = await getAdminTransactions();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 md:px-8">
      <AdminNav active="/admin/transactions" />

      <div className="w-full max-w-5xl space-y-3">
        {txs.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground rounded-2xl">
            No transactions yet
          </Card>
        ) : (
          txs.map((tx) => (
            <Card key={tx.id} className="p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold truncate">{tx.user.username}</p>
                <p className="text-sm text-muted-foreground truncate">{tx.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 font-black text-lg shrink-0 ${
                  tx.amount >= 0 ? "text-success" : "text-danger"
                }`}
              >
                <Coins className="w-4 h-4" />
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
