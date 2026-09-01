"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { GameHUD } from "@/components/GameHUD";
import { Coins, Gift, X, Check, ChevronRight, Lock } from "lucide-react";
import { purchaseReward } from "@/app/actions/rewards";

type Reward = {
  id: string;
  name: string;
  image: string;
  coinCost: number;
  minXp: number;
  minAccuracy: number;
};

type UserStats = {
  coins: number;
  netXp: number;
  accuracy: number;
  username: string;
};

function getLockReasons(r: Reward, user: UserStats): string[] {
  const reasons: string[] = [];
  if (user.coins < r.coinCost) reasons.push(`Need ${r.coinCost} coins`);
  if (r.minXp > 0 && user.netXp < r.minXp) reasons.push(`Need ${r.minXp} XP`);
  if (r.minAccuracy > 0 && user.accuracy < r.minAccuracy) {
    reasons.push(`Need ${r.minAccuracy}% accuracy`);
  }
  return reasons;
}

function SlideToConfirm({
  disabled,
  loading,
  onConfirm,
  label,
}: {
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const maxRef = useRef(0);

  const onStart = (clientX: number) => {
    if (disabled || loading) return;
    const track = trackRef.current;
    if (!track) return;
    maxRef.current = track.offsetWidth - 56;
    startX.current = clientX - offset;
    setDragging(true);
  };

  const onMove = (clientX: number) => {
    if (!dragging) return;
    const next = Math.max(0, Math.min(maxRef.current, clientX - startX.current));
    setOffset(next);
  };

  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (offset > maxRef.current * 0.85) {
      setOffset(maxRef.current);
      onConfirm();
      setTimeout(() => setOffset(0), 400);
    } else {
      setOffset(0);
    }
  };

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-2xl overflow-hidden select-none touch-none border ${
        disabled ? "opacity-50 border-border bg-muted" : "border-primary/30 bg-primary/10"
      }`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onStart(e.clientX);
      }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-sm font-bold text-primary/80 flex items-center gap-1">
          {loading ? "Placing order…" : label}
          {!loading && <ChevronRight className="w-4 h-4 animate-pulse" />}
        </span>
      </div>
      <div
        className="absolute top-1 left-1 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : "transform 0.2s" }}
      >
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Check className="w-6 h-6" />
        )}
      </div>
    </div>
  );
}

export function RewardsStore({ rewards, user }: { rewards: Reward[]; user: UserStats }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Reward | null>(null);
  const [step, setStep] = useState<"detail" | "checkout" | "confirm">("detail");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canBuy = (r: Reward) => getLockReasons(r, user).length === 0;

  const close = () => {
    setSelected(null);
    setStep("detail");
    setError("");
    setSuccess(false);
  };

  const handlePurchase = async () => {
    if (!selected) return;
    const reasons = getLockReasons(selected, user);
    if (reasons.length > 0) {
      setError(reasons[0]);
      return;
    }
    if (!fullName.trim() || !phone.trim() || !address.trim() || !city.trim() || !country.trim()) {
      setError("Fill in all delivery details.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await purchaseReward({
      rewardId: selected.id,
      fullName,
      phone,
      address,
      city,
      country,
    });
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      close();
      router.refresh();
    }, 1800);
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full flex flex-col items-center py-5 px-4 md:py-8 md:px-8">
        <div className="w-full max-w-4xl flex justify-between items-center mb-6 gap-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Store</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* On mobile: only show points/coins, no XP or accuracy */}
            <div className="flex md:hidden items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-2xl shadow-sm">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-black text-amber-400 tabular-nums">{user.coins}</span>
            </div>

            {/* On desktop: show full GameHUD */}
            <div className="hidden md:block">
              <GameHUD coins={user.coins} xp={user.netXp} accuracy={user.accuracy} compact />
            </div>
            <NavMenu />
          </div>
        </div>

        {rewards.length === 0 ? (
          <Card className="w-full max-w-4xl p-12 text-center rounded-[1.75rem]">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-bold text-muted-foreground">Store is empty</p>
          </Card>
        ) : (
          <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
            {rewards.map((r) => {
              const reasons = getLockReasons(r, user);
              const unlocked = reasons.length === 0;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r);
                    setStep("detail");
                    setError("");
                    setSuccess(false);
                  }}
                  className={`text-left rounded-[1.5rem] border overflow-hidden transition-all active:scale-[0.98] bg-card/60 ${
                    unlocked
                      ? "border-white/10 hover:border-primary/40 shadow-lg shadow-black/20"
                      : "border-white/5 opacity-75"
                  }`}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
                    {!unlocked && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-white/90" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="font-bold text-sm md:text-base leading-snug line-clamp-2 mb-2">
                      {r.name}
                    </h3>
                    <p className="text-lg md:text-xl font-black text-amber-400 flex items-center gap-1.5">
                      <Coins className="w-4 h-4" />
                      {r.coinCost}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
            <Card className="relative w-full sm:max-w-lg rounded-t-[1.75rem] sm:rounded-[1.75rem] max-h-[92vh] overflow-y-auto p-5 md:p-7 border-white/10">
              <div className="flex items-start justify-between mb-5">
                <div className="flex gap-3 min-w-0">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted shrink-0">
                    <img
                      src={selected.image}
                      alt={selected.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black truncate">{selected.name}</h2>
                    <p className="text-2xl font-black text-amber-400 mt-1 flex items-center gap-1.5">
                      <Coins className="w-5 h-5" />
                      {selected.coinCost}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance after: {user.coins - selected.coinCost} coins
                    </p>
                  </div>
                </div>
                <button
                  onClick={close}
                  className="w-11 h-11 rounded-2xl hover:bg-muted flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {success ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                  <p className="text-2xl font-black text-success">Order confirmed!</p>
                  <p className="text-muted-foreground mt-1">We&apos;ll get it to you soon</p>
                </div>
              ) : getLockReasons(selected, user).length > 0 ? (
                <div className="space-y-2 bg-danger/10 border border-danger/20 rounded-2xl p-4">
                  {getLockReasons(selected, user).map((msg) => (
                    <p key={msg} className="text-sm text-danger font-bold flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {msg}
                    </p>
                  ))}
                </div>
              ) : step === "detail" ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Unlock this reward forever with coins. Delivery details next.
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-14 rounded-2xl text-lg font-black"
                    onClick={() => setStep("checkout")}
                  >
                    Continue
                  </Button>
                </div>
              ) : step === "checkout" ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Delivery
                  </p>
                  <Input
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 rounded-2xl text-base"
                  />
                  <Input
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 rounded-2xl text-base"
                  />
                  <Input
                    placeholder="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-12 rounded-2xl text-base"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-12 rounded-2xl text-base"
                    />
                    <Input
                      placeholder="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-12 rounded-2xl text-base"
                    />
                  </div>
                  {error && (
                    <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-2xl">
                      {error}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="w-full h-14 rounded-2xl text-lg font-black"
                    onClick={() => {
                      if (
                        !fullName.trim() ||
                        !phone.trim() ||
                        !address.trim() ||
                        !city.trim() ||
                        !country.trim()
                      ) {
                        setError("Fill in all delivery details.");
                        return;
                      }
                      setError("");
                      setStep("confirm");
                    }}
                  >
                    Review order
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item</span>
                      <span className="font-bold">{selected.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pay</span>
                      <span className="font-black text-amber-400">{selected.coinCost} coins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ship to</span>
                      <span className="font-bold text-right max-w-[60%]">
                        {fullName}, {city}
                      </span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Sure you want to buy this? Coins won&apos;t be refunded.
                  </p>
                  {error && (
                    <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-2xl">
                      {error}
                    </p>
                  )}
                  <SlideToConfirm
                    label="Slide to pay"
                    loading={loading}
                    disabled={loading || !canBuy(selected)}
                    onConfirm={handlePurchase}
                  />
                  <button
                    type="button"
                    className="w-full text-center text-sm text-muted-foreground py-2"
                    onClick={() => setStep("checkout")}
                    disabled={loading}
                  >
                    Edit details
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
