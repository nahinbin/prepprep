"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { createReward, updateReward, deleteReward } from "@/app/actions/rewards";

type Reward = {
  id: string;
  name: string;
  image: string;
  coinCost: number;
  minXp: number;
  minAccuracy: number;
  isActive: boolean;
};

export function AdminRewardsClient({ rewards }: { rewards: Reward[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [coinCost, setCoinCost] = useState(100);
  const [minXp, setMinXp] = useState(0);
  const [minAccuracy, setMinAccuracy] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setImage("");
    setCoinCost(100);
    setMinXp(0);
    setMinAccuracy(0);
    setIsActive(true);
    setError("");
  };

  const startEdit = (r: Reward) => {
    setEditingId(r.id);
    setShowForm(true);
    setName(r.name);
    setImage(r.image);
    setCoinCost(r.coinCost);
    setMinXp(r.minXp);
    setMinAccuracy(r.minAccuracy);
    setIsActive(r.isActive);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    if (editingId) {
      const res = await updateReward(editingId, {
        name,
        image: image || undefined,
        coinCost,
        minXp,
        minAccuracy,
        isActive,
      });
      if (res.error) setError(res.error);
      else {
        resetForm();
        router.refresh();
      }
    } else {
      const res = await createReward({ name, image, coinCost, minXp, minAccuracy });
      if (res.error) setError(res.error);
      else {
        resetForm();
        router.refresh();
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, rewardName: string) => {
    if (!confirm(`Remove reward "${rewardName}"?`)) return;
    setLoading(true);
    await deleteReward(id);
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="flex justify-end">
        <Button
          className="h-12 px-6 rounded-2xl font-bold"
          onClick={() => {
            if (showForm && !editingId) resetForm();
            else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Reward
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 md:p-8 rounded-2xl space-y-5">
          <h2 className="text-xl font-bold">{editingId ? "Edit Reward" : "New Reward"}</h2>

          <div className="flex flex-col items-center gap-3">
            <div
              className="w-40 h-40 rounded-2xl bg-muted border-2 border-border overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              {image ? (
                <img src={image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <p className="text-sm text-muted-foreground">Tap to upload image</p>
          </div>

          <Input
            placeholder="Reward name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-2xl text-lg"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Coin Cost
              </label>
              <Input
                type="number"
                min={0}
                value={coinCost}
                onChange={(e) => setCoinCost(Number(e.target.value))}
                className="h-12 rounded-2xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Min XP (0 = none)
              </label>
              <Input
                type="number"
                min={0}
                value={minXp}
                onChange={(e) => setMinXp(Number(e.target.value))}
                className="h-12 rounded-2xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Min Accuracy % (0 = none)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={minAccuracy}
                onChange={(e) => setMinAccuracy(Number(e.target.value))}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          {editingId && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-medium">Active in store</span>
            </label>
          )}

          {error && (
            <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-2xl">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" className="rounded-2xl" onClick={resetForm}>
              Cancel
            </Button>
            <Button className="rounded-2xl font-bold px-8" onClick={handleSubmit} isLoading={loading}>
              {editingId ? "Save" : "Create"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rewards.map((r) => (
          <Card key={r.id} className={`p-5 rounded-2xl ${!r.isActive ? "opacity-50" : ""}`}>
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted shrink-0">
                <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold truncate">{r.name}</h3>
                <p className="text-amber-500 font-black text-xl mt-1">{r.coinCost} coins</p>
                <p className="text-sm text-muted-foreground mt-1">
                  XP ≥ {r.minXp} · Acc ≥ {r.minAccuracy}%
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="ghost" className="rounded-2xl w-10 h-10 p-0" onClick={() => startEdit(r)}>
                  <Pencil className="w-5 h-5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-2xl w-10 h-10 p-0 text-danger hover:bg-danger/10"
                  onClick={() => handleDelete(r.id, r.name)}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {rewards.length === 0 && !showForm && (
        <Card className="p-12 text-center text-muted-foreground rounded-2xl">
          <p className="text-lg font-bold">No rewards yet</p>
        </Card>
      )}
    </div>
  );
}
