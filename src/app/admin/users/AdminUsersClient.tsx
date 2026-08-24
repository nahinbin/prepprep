"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Coins, User as UserIcon, Pencil, X } from "lucide-react";
import { adminUpdateUser } from "@/app/actions/admin-users";

type AdminUser = {
  id: string;
  username: string;
  profilePicture: string | null;
  coins: number;
  positivePoints: number;
  negativePoints: number;
  netXp: number;
  accuracy: number;
  sessionCount: number;
  mistakeCount: number;
  orderCount: number;
  orders: Array<{
    id: string;
    rewardName: string;
    coinCost: number;
    status: string;
  }>;
};

export function AdminUsersClient({ users: initial }: { users: AdminUser[] }) {
  const [users, setUsers] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coins, setCoins] = useState(0);
  const [picture, setPicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setUsername(u.username);
    setPassword("");
    setCoins(u.coins);
    setPicture(u.profilePicture);
    setError("");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPicture(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!editingId) return;
    setLoading(true);
    setError("");
    const res = await adminUpdateUser(editingId, {
      username,
      password: password || undefined,
      coins,
      profilePicture: picture,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingId
          ? { ...u, username, coins, profilePicture: picture }
          : u
      )
    );
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-5xl space-y-4">
      {users.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground rounded-2xl">
          <p className="text-lg font-bold">No users yet</p>
        </Card>
      ) : (
        users.map((user) => (
          <Card key={user.id} className="p-5 md:p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted border-2 border-primary/20 overflow-hidden flex items-center justify-center">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{user.username}</h2>
                  <p className="text-sm text-muted-foreground">
                    {user.sessionCount} sessions · {user.orderCount} orders · {user.mistakeCount}{" "}
                    mistakes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-center px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Coins</p>
                    <p className="text-lg font-black text-amber-500 flex items-center justify-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      {user.coins}
                    </p>
                  </div>
                  <div className="text-center px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">XP</p>
                    <p className="text-lg font-black text-primary">{user.netXp}</p>
                  </div>
                  <div className="text-center px-3 py-2 bg-success/10 border border-success/20 rounded-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">+XP</p>
                    <p className="text-lg font-black text-success">{user.positivePoints}</p>
                  </div>
                  <div className="text-center px-3 py-2 bg-muted border border-border rounded-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Acc</p>
                    <p className="text-lg font-black">{user.accuracy}%</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0"
                  onClick={() => openEdit(user)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingId(null)} />
          <Card className="relative w-full max-w-md p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit user</h3>
              <button onClick={() => setEditingId(null)} className="p-2 rounded-xl hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                {picture ? (
                  <img src={picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <label className="text-sm font-semibold text-primary cursor-pointer hover:underline">
                Change photo
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                New password
              </label>
              <Input
                type="password"
                placeholder="Leave blank to keep"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Coins</label>
              <Input
                type="number"
                min={0}
                value={coins}
                onChange={(e) => setCoins(Number(e.target.value))}
                className="mt-1 h-11 rounded-xl"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button className="w-full h-11 rounded-xl font-bold" onClick={save} isLoading={loading}>
              Save changes
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
