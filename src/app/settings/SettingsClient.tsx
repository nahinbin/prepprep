"use client";

import { useState } from "react";
import { User as UserType } from "@prisma/client";
import { AppShell } from "@/components/NavMenu";
import { updateProfile } from "@/app/actions/user";
import { User, Mail, Shield, Lock, Eye, ChevronRight, Check } from "lucide-react";
import { BackButton } from "@/components/BackButton";

type EditField = "username" | "name" | "bio" | "email" | null;

export function SettingsClient({ user }: { user: UserType }) {
  const [editing, setEditing] = useState<EditField>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSave(formData: FormData) {
    setIsPending(true);
    await updateProfile(formData);
    setIsPending(false);
    setEditing(null);
  }

  async function togglePrivacy(formData: FormData) {
    setIsPending(true);
    // When submitting the toggle, we just send all fields, modifying isPublic
    await updateProfile(formData);
    setIsPending(false);
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Settings</h1>
        </div>

        <div className="rounded-3xl bg-card border-2 border-border shadow-sm overflow-hidden">
          <div className="p-4 bg-muted/30 border-b border-border/50">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Public Profile
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            <SettingRow 
              label="Username" 
              value={user.username} 
              isEditing={editing === "username"}
              onClick={() => setEditing("username")}
              onCancel={() => setEditing(null)}
              onSubmit={handleSave}
              inputName="username"
              inputType="text"
              isPending={isPending}
            />
            <SettingRow 
              label="Display Name" 
              value={user.name || "Not set"} 
              isEditing={editing === "name"}
              onClick={() => setEditing("name")}
              onCancel={() => setEditing(null)}
              onSubmit={handleSave}
              inputName="name"
              inputType="text"
              isPending={isPending}
            />
            <SettingRow 
              label="Bio" 
              value={user.bio || "Not set"} 
              isEditing={editing === "bio"}
              onClick={() => setEditing("bio")}
              onCancel={() => setEditing(null)}
              onSubmit={handleSave}
              inputName="bio"
              inputType="textarea"
              isPending={isPending}
            />
          </div>
        </div>

        <div className="rounded-3xl bg-card border-2 border-border shadow-sm overflow-hidden">
          <div className="p-4 bg-muted/30 border-b border-border/50">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Account & Privacy
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            <SettingRow 
              label="Email Address" 
              value={user.email || "Not set"} 
              isEditing={editing === "email"}
              onClick={() => setEditing("email")}
              onCancel={() => setEditing(null)}
              onSubmit={handleSave}
              inputName="email"
              inputType="email"
              isPending={isPending}
            />
            
            <form action={togglePrivacy} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">Public Account</p>
                <p className="text-[11px] font-medium text-muted-foreground max-w-[200px] sm:max-w-xs">
                  {user.isPublic ? "Anyone can view your stats and leaderboard rank." : "Only friends can view your stats and rank."}
                </p>
              </div>
              
              <input type="hidden" name="username" value={user.username} />
              <input type="hidden" name="name" value={user.name || ""} />
              <input type="hidden" name="bio" value={user.bio || ""} />
              <input type="hidden" name="email" value={user.email || ""} />
              <input type="hidden" name="isPublic" value={user.isPublic ? "false" : "true"} /> {/* Toggle opposite */}

              <button 
                type="submit" 
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.isPublic ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ 
  label, 
  value, 
  isEditing, 
  onClick, 
  onCancel, 
  onSubmit, 
  inputName, 
  inputType,
  isPending
}: any) {
  if (isEditing) {
    return (
      <div className="p-4 bg-muted/10">
        <form action={onSubmit} className="space-y-3">
          <label className="text-xs font-bold text-muted-foreground uppercase">{label}</label>
          
          {inputType === "textarea" ? (
            <textarea
              name={inputName}
              defaultValue={value === "Not set" ? "" : value}
              autoFocus
              className="w-full p-3 rounded-xl bg-background border-2 border-border/50 focus:border-primary transition-all outline-none font-medium min-h-[80px]"
            />
          ) : (
            <input
              type={inputType}
              name={inputName}
              defaultValue={value === "Not set" ? "" : value}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border/50 focus:border-primary transition-all outline-none font-medium"
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <button 
              type="submit" 
              disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button 
              type="button" 
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 bg-muted hover:bg-muted-foreground/20 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
    >
      <div className="space-y-0.5 max-w-[80%]">
        <p className="font-bold text-foreground">{label}</p>
        <p className="text-sm font-medium text-muted-foreground truncate">{value}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}
