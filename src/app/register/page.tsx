"use client";

import { useState, useRef } from "react";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { Upload, User as UserIcon, Eye, EyeOff, Lock, Sparkles, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePic, setProfilePic] = useState<string>("");
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
    const formData = new FormData(e.currentTarget);
    if (profilePic) {
      formData.append("profilePicture", profilePic);
    }
    const res = await register(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background game-bg">
      <Card className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-2 shadow-2xl backdrop-blur-md">
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border-2 border-primary/30 text-primary mb-2 shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Create Account</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Join now and start mastering MCQs
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <div 
              className="w-24 h-24 rounded-3xl bg-muted/60 border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer relative group transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
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
            <p className="text-xs font-semibold text-muted-foreground mt-2">Upload avatar (optional)</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="username"
                placeholder="Choose a username"
                required
                className="pl-12 h-13 text-base font-bold rounded-2xl border-2 bg-background/50 focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a password"
                required
                className="flex h-13 w-full rounded-2xl border-2 border-border bg-background/50 pl-12 pr-12 text-base font-bold text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm font-bold text-danger text-center bg-danger/10 p-3.5 rounded-2xl border border-danger/20 animate-fade-in">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-black rounded-2xl shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2 mt-2"
            isLoading={loading}
          >
            <span>Sign Up</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        </form>

        <div className="mt-8 text-center text-sm font-bold pt-4 border-t border-border/60">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/login" className="text-primary hover:underline ml-1">
            Log In
          </Link>
        </div>
      </Card>
    </div>
  );
}
