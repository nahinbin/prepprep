"use client";

import { useState, useRef } from "react";
import { updateProfile } from "@/app/actions/user";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import {
  Coins,
  Upload,
  User as UserIcon,
  Trophy,
  TrendingUp,
  TrendingDown,
  Shield,
  Camera,
  Check,
  Zap,
} from "lucide-react";
import { getLevelInfo } from "@/lib/levels";

export function ProfileForm({ user }: { user: any }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState<string>(user.profilePicture || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    if (profilePic !== user.profilePicture) {
      formData.append("profilePicture", profilePic);
    }

    const res = await updateProfile(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  const netXp = user.positivePoints - user.negativePoints;
  const lvl = getLevelInfo(netXp);

  return (
    <AppShell showBottomBar={false}>
      <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Player Profile</h1>
          </div>
          <NavMenu />
        </div>

        {/* Hero Avatar & Level Section (Seen First!) */}
        <div className="w-full text-center space-y-3">
          <div className="relative inline-block mx-auto">
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-muted border-4 border-primary/40 overflow-hidden flex items-center justify-center cursor-pointer group shadow-xl shadow-primary/10 transition-all hover:scale-105 hover:border-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              {profilePic ? (
                <img src={profilePic} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-14 h-14 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1 rounded-3xl">
                <Camera className="w-6 h-6" />
                <span>Change</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 active:scale-95 transition-all"
              title="Upload new avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">{user.username}</h2>
            <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-1 rounded-xl bg-primary/15 border border-primary/30">
              <Shield className={`w-4 h-4 ${lvl.color}`} />
              <span className={`text-sm font-black ${lvl.color}`}>{lvl.title}</span>
              <span className="text-xs font-bold text-muted-foreground">· Level {lvl.level}</span>
            </div>
          </div>
        </div>

        {/* Level & XP Progress Card */}
        <Card className="w-full p-5 sm:p-6 rounded-3xl border-2 space-y-3 bg-card shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary fill-primary/30" />
              <span className="font-black text-base">XP Progress</span>
            </div>
            <span className="text-base font-black text-primary tabular-nums">{netXp} XP</span>
          </div>

          <div className="w-full h-3.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border/70">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full xp-bar-glow transition-all duration-700"
              style={{ width: `${lvl.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Level {lvl.level} ({lvl.progress}%)</span>
            {lvl.xpEnd !== Infinity ? (
              <span>{lvl.xpEnd - netXp} XP to Level {lvl.level + 1} ({lvl.xpEnd} XP)</span>
            ) : (
              <span className="text-primary font-black">MAX LEVEL</span>
            )}
          </div>
        </Card>

        {/* Compact Game Stats Grid */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Coin Balance */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col items-center text-center shadow-sm">
            <Coins className="w-6 h-6 text-amber-500 mb-1" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Coins</span>
            <span className="text-xl sm:text-2xl font-black text-amber-500 tabular-nums">{user.coins}</span>
          </div>

          {/* Positive XP */}
          <div className="p-4 rounded-2xl bg-success/10 border border-success/25 flex flex-col items-center text-center shadow-sm">
            <TrendingUp className="w-6 h-6 text-success mb-1" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Earned</span>
            <span className="text-xl sm:text-2xl font-black text-success tabular-nums">+{user.positivePoints}</span>
          </div>

          {/* Negative XP */}
          <div className="p-4 rounded-2xl bg-danger/10 border border-danger/25 flex flex-col items-center text-center shadow-sm">
            <TrendingDown className="w-6 h-6 text-danger mb-1" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Lost</span>
            <span className="text-xl sm:text-2xl font-black text-danger tabular-nums">-{user.negativePoints}</span>
          </div>

          {/* Net Score */}
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 flex flex-col items-center text-center shadow-sm">
            <Trophy className="w-6 h-6 text-primary mb-1" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Net XP</span>
            <span className="text-xl sm:text-2xl font-black text-primary tabular-nums">{netXp}</span>
          </div>
        </div>

        {/* Account Details Form */}
        <Card className="w-full p-6 sm:p-7 rounded-3xl border-2 space-y-5 bg-card shadow-md">
          <h3 className="text-base font-black text-foreground">Account Settings</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
                Username
              </label>
              <Input
                name="username"
                defaultValue={user.username}
                required
                className="h-12 text-base font-bold rounded-2xl border-2"
              />
            </div>

            {error && (
              <p className="text-sm font-bold text-danger text-center bg-danger/10 p-3 rounded-xl border border-danger/20">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm font-bold text-success text-center bg-success/10 p-3 rounded-xl border border-success/20 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Profile updated successfully!
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-13 text-base font-black rounded-2xl shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              isLoading={loading}
            >
              Save Changes
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
