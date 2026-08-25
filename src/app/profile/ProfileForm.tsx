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
  Pencil,
  X,
} from "lucide-react";
import { getLevelInfo } from "@/lib/levels";

export function ProfileForm({ user }: { user: any }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState<string>(user.profilePicture || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.username);
  const [currentUsername, setCurrentUsername] = useState(user.username);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setProfilePic(base64);
        setLoading(true);
        setError("");
        setSuccess("");

        const formData = new FormData();
        formData.append("username", currentUsername);
        formData.append("profilePicture", base64);

        const res = await updateProfile(formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess("Profile picture updated!");
          setTimeout(() => setSuccess(""), 3000);
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUsername = async () => {
    if (!usernameInput.trim() || usernameInput.trim() === currentUsername) {
      setIsEditingUsername(false);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("username", usernameInput.trim());
    if (profilePic) {
      formData.append("profilePicture", profilePic);
    }

    const res = await updateProfile(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      setCurrentUsername(usernameInput.trim());
      setIsEditingUsername(false);
      setSuccess("Username updated!");
      setTimeout(() => setSuccess(""), 3000);
    }
    setLoading(false);
  };

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

        {/* Hero Avatar & Username Section (Seen First!) */}
        <div className="w-full text-center space-y-3">
          <div className="relative inline-block mx-auto">
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-muted border-4 border-primary/40 overflow-hidden flex items-center justify-center cursor-pointer group shadow-xl shadow-primary/10 transition-all hover:scale-105 hover:border-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              {profilePic ? (
                <img src={profilePic} alt={currentUsername} className="w-full h-full object-cover" />
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

          {/* Inline Username with Pin/Pencil Edit Icon */}
          <div>
            {isEditingUsername ? (
              <div className="flex items-center justify-center gap-2 max-w-xs mx-auto animate-fade-in">
                <Input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUsername();
                    if (e.key === "Escape") setIsEditingUsername(false);
                  }}
                  className="h-11 text-lg font-bold rounded-2xl border-2 text-center"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSaveUsername}
                  isLoading={loading}
                  className="h-11 px-3.5 rounded-2xl font-black shrink-0"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingUsername(false)}
                  className="h-11 px-3 rounded-2xl font-bold shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">{currentUsername}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setUsernameInput(currentUsername);
                    setIsEditingUsername(true);
                  }}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Edit Username"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1 rounded-xl bg-primary/15 border border-primary/30 shadow-xs">
              <Shield className={`w-4 h-4 ${lvl.color}`} />
              <span className={`text-sm font-black ${lvl.color}`}>{lvl.title}</span>
              <span className="text-xs font-bold text-muted-foreground">· Level {lvl.level}</span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <p className="text-sm font-bold text-danger text-center bg-danger/10 p-3 rounded-2xl border border-danger/20 animate-fade-in max-w-sm mx-auto">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm font-bold text-success text-center bg-success/10 p-3 rounded-2xl border border-success/20 flex items-center justify-center gap-1.5 animate-fade-in max-w-sm mx-auto">
              <Check className="w-4 h-4" /> {success}
            </p>
          )}
        </div>

        {/* Level & XP Progress Card */}
        <Card className="w-full p-5 sm:p-6 rounded-3xl border-2 space-y-3 bg-card shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary fill-primary/30" />
              <span className="font-black text-base">XP Progression</span>
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
      </div>
    </AppShell>
  );
}
