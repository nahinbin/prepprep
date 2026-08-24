"use client";

import { useState, useRef } from "react";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { Upload, User as UserIcon } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-2">Join to start tracking your MCQs</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div 
              className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center cursor-pointer relative group"
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
            <p className="text-xs text-muted-foreground mt-2">Upload Profile Picture (optional)</p>
          </div>

          <Input name="username" placeholder="Username" required />
          <Input type="password" name="password" placeholder="Password" required />
          {error && <p className="text-sm text-danger text-center">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Sign Up
          </Button>
        </form>
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/login" className="text-primary hover:underline">
            Log In
          </Link>
        </div>
      </Card>
    </div>
  );
}
