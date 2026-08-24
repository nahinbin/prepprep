"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackButton({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-muted transition-colors active:scale-95"
      aria-label="Back"
    >
      <ArrowLeft className="w-5 h-5" />
    </Link>
  );
}
