"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { Coins, Package, History as HistoryIcon } from "lucide-react";

type Tx = { id: string; amount: number; reason: string; createdAt: Date | string };
type Order = {
  id: string;
  coinCost: number;
  status: string;
  createdAt: Date | string;
  reward: { name: string; image: string };
};
type SessionRow = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  netPoints: number;
  isPractice: boolean;
  createdAt: Date | string;
};

export function HistoryView({
  transactions,
  orders,
  sessions,
}: {
  transactions: Tx[];
  orders: Order[];
  sessions: SessionRow[];
}) {
  const [tab, setTab] = useState<"sessions" | "transactions" | "orders">("sessions");

  const tabs = [
    { id: "sessions" as const, label: "Sessions", icon: HistoryIcon },
    { id: "transactions" as const, label: "Coins", icon: Coins },
    { id: "orders" as const, label: "Orders", icon: Package },
  ];

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full p-4 md:p-8">
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BackButton />
              <h1 className="text-xl md:text-2xl font-bold">History</h1>
            </div>
            <NavMenu />
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border shrink-0 ${
                  tab === id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {tab === "sessions" && (
            <div className="space-y-3">
              {sessions.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground rounded-2xl">
                  No sessions yet
                </Card>
              )}
              {sessions.map((s) => (
                <Card key={s.id} className="p-4 rounded-2xl flex justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {s.isPractice ? "Practice" : "Session"} · {s.totalQuestions} Q
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {s.correctAnswers} correct · {s.wrongAnswers} wrong
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!s.isPractice && (
                    <span
                      className={`font-black text-lg ${
                        s.netPoints >= 0 ? "text-primary" : "text-danger"
                      }`}
                    >
                      {s.netPoints > 0 ? "+" : ""}
                      {s.netPoints} XP
                    </span>
                  )}
                </Card>
              ))}
            </div>
          )}

          {tab === "transactions" && (
            <div className="space-y-3">
              {transactions.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground rounded-2xl">
                  No transactions yet
                </Card>
              )}
              {transactions.map((tx) => (
                <Card key={tx.id} className="p-4 rounded-2xl flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{tx.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`font-black shrink-0 ${
                      tx.amount >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </span>
                </Card>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-3">
              {orders.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground rounded-2xl">
                  No orders yet
                </Card>
              )}
              {orders.map((o) => (
                <Card key={o.id} className="p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                    <img
                      src={o.reward.image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{o.reward.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.coinCost} coins · {new Date(o.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                      o.status === "completed"
                        ? "bg-success/15 text-success"
                        : o.status === "shipped"
                          ? "bg-primary/15 text-primary"
                          : o.status === "cancelled"
                            ? "bg-danger/15 text-danger"
                            : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {o.status}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
