"use client";

import { useState } from "react";
import { adminLogin } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Shield } from "lucide-react";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const res = await adminLogin(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 md:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">
              Username
            </label>
            <Input name="username" required autoComplete="username" className="h-12 rounded-2xl" />
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">
              Password
            </label>
            <Input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 rounded-2xl"
            />
          </div>

          {error && (
            <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-2xl">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold" isLoading={loading}>
            Login
          </Button>
        </form>
      </Card>
    </div>
  );
}
