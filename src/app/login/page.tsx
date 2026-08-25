"use client";

import { useState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { Eye, EyeOff, Lock, User, Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const res = await login(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background game-bg">
      <Card className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-2 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border-2 border-primary/30 text-primary mb-2 shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Welcome Back</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Log in to continue your MCQ journey
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
              Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="username"
                placeholder="Enter username"
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
                placeholder="Enter password"
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
            <span>Log In</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        </form>

        <div className="mt-8 text-center text-sm font-bold pt-4 border-t border-border/60">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link href="/register" className="text-primary hover:underline ml-1">
            Register now
          </Link>
        </div>
      </Card>
    </div>
  );
}
