"use client";

import { useState, useRef } from "react";
import { updateProfile } from "@/app/actions/user";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { Coins, Upload, User as UserIcon, Trophy, TrendingUp, TrendingDown, Shield } from "lucide-react";
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
    <AppShell>
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl p-5 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-xl md:text-2xl font-bold">Profile</h1>
          </div>
          <NavMenu />
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius)] p-6 flex flex-col items-center justify-center text-center shadow-inner">
              <Coins className="w-12 h-12 text-amber-500 mb-2" />
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Coin Balance</p>
              <h2 className="text-4xl font-black text-amber-500 mt-1">{user.coins}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/50 border border-border p-4 rounded-[var(--radius)] text-center shadow-sm">
                <TrendingUp className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="text-xs text-muted-foreground uppercase">+ XP</p>
                <p className="text-xl font-bold text-success">{user.positivePoints}</p>
              </div>
              <div className="bg-background/50 border border-border p-4 rounded-[var(--radius)] text-center shadow-sm">
                <TrendingDown className="w-6 h-6 text-danger mx-auto mb-2" />
                <p className="text-xs text-muted-foreground uppercase">- XP</p>
                <p className="text-xl font-bold text-danger">{user.negativePoints}</p>
              </div>
            </div>

            {/* Level Card */}
            <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${lvl.color}`} />
                  <span className={`font-black text-base ${lvl.color}`}>{lvl.title}</span>
                </div>
                <span className="text-2xl font-black text-primary">Lv {lvl.level}</span>
              </div>
              {/* XP progress bar */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full xp-bar-glow transition-all duration-500"
                  style={{ width: `${lvl.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{lvl.xpIntoLevel} XP</span>
                {lvl.xpEnd !== Infinity ? (
                  <span>{lvl.xpForLevel} XP to next level</span>
                ) : (
                  <span className="text-primary font-bold">MAX LEVEL</span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                <span className="text-muted-foreground flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Net XP</span>
                <span className={`font-black ${netXp >= 0 ? "text-primary" : "text-danger"}`}>{netXp}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 border-t md:border-t-0 md:border-l border-border pt-8 md:pt-0 md:pl-8">
            <h2 className="text-lg font-semibold mb-6">Account Details</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center">
                <div 
                  className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center cursor-pointer relative group shadow-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageChange}
                />
                <p className="text-xs text-muted-foreground mt-2 font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => fileInputRef.current?.click()}>
                  Tap to change picture
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Username</label>
                <Input name="username" defaultValue={user.username} required />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {success && <p className="text-sm text-success font-medium">Profile updated successfully!</p>}

              <Button type="submit" className="w-full" isLoading={loading}>
                Save Changes
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
    </AppShell>
  );
}
