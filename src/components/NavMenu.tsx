"use client";

import { useState, createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  Layers,
  LogOut,
  Gift,
  History,
  Database,
  Settings,
  Bell,
  Users,
  CalendarCheck,
  Bot,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Suspense } from "react";
import { BottomBar } from "@/components/BottomBar";
import { QuickMuteButton } from "@/components/QuickMuteButton";
import { getAiAssistantName } from "@/lib/routineStorage";

const ShellCtx = createContext<{ mistakeCount: number }>({ mistakeCount: 0 });

function NavLinks({
  onNavigate,
  className = "",
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const [aiName, setAiName] = useState(() => getAiAssistantName());

  useEffect(() => {
    const handleNameChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) setAiName(customEvent.detail);
      else setAiName(getAiAssistantName());
    };
    window.addEventListener("ai-assistant-name-updated", handleNameChange);
    return () => window.removeEventListener("ai-assistant-name-updated", handleNameChange);
  }, []);

  const links = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/routine", label: "Daily Routine", icon: CalendarCheck, match: (p: string) => p === "/routine" || p === "/planner" || p === "/schedule" },
    { href: "/chat", label: aiName || "AI Assistant", icon: Bot, match: (p: string) => p === "/chat" },
    { href: "/notifications", label: "Notifications", icon: Bell, match: (p: string) => p === "/notifications" },
    { href: "/questions", label: "Question Bank", icon: Database, match: (p: string) => p === "/questions" },
    { href: "/history", label: "History", icon: History, match: (p: string) => p === "/history" },
    { href: "/rewards", label: "Store", icon: Gift, match: (p: string) => p === "/rewards" },
    { href: "/subjects", label: "Subjects", icon: Layers, match: (p: string) => p === "/subjects" },
    { href: "/friends", label: "Friends", icon: Users, match: (p: string) => p === "/friends" },
  ];

  return (
    <nav className={className}>
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-bold transition-all active:scale-[0.98] ${
              active
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "hover:bg-white/5 text-foreground/85"
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function NavLinksSafe(props: { onNavigate?: () => void; className?: string }) {
  return (
    <Suspense fallback={<nav className={props.className} />}>
      <NavLinks {...props} />
    </Suspense>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-3 top-3 bottom-3 w-64 flex-col rounded-[1.75rem] border border-white/10 bg-card/90 backdrop-blur-xl z-40 shadow-2xl shadow-black/40 overflow-hidden">
      <div className="px-5 py-6">
        <Link href="/" className="block">
          <span className="text-xl font-black tracking-tight text-primary">MCQ Arena</span>
          <span className="block text-xs text-muted-foreground font-semibold mt-0.5">Play · Learn · Win</span>
        </Link>
      </div>
      <NavLinksSafe className="flex-1 px-3 space-y-1.5 overflow-y-auto" />
      <div className="p-3 border-t border-white/5 flex gap-2">
        <form action={logout} className="flex-1">
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-base font-bold text-danger hover:bg-danger/10 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Logout
          </button>
        </form>
        <QuickMuteButton className="w-12 h-auto rounded-2xl border-white/10" />
        <Link
          href="/settings"
          className="flex items-center justify-center w-12 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </aside>
  );
}

export function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-2xl hover:bg-muted/80 transition-colors active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] w-[min(20rem,calc(100vw-1rem))] bg-card border border-white/10 shadow-2xl rounded-[1.75rem] overflow-hidden flex flex-col">
            <div className="flex items-center justify-end p-5 pb-2">
              <button
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <NavLinksSafe onNavigate={() => setOpen(false)} className="px-3 space-y-1.5 flex-1" />

            <div className="p-3 border-t border-white/5 flex gap-2">
              <form action={logout} className="flex-1">
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-base font-bold text-danger hover:bg-danger/10 transition-all"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  Logout
                </button>
              </form>
              <QuickMuteButton className="w-12 h-auto rounded-2xl border-white/10" />
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-12 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell({
  children,
  showSidebar = true,
  showBottomBar = true,
  mistakeCount = 0,
}: {
  children: React.ReactNode;
  showSidebar?: boolean;
  showBottomBar?: boolean;
  mistakeCount?: number;
}) {
  return (
    <ShellCtx.Provider value={{ mistakeCount }}>
      <div className="min-h-[100dvh] bg-background game-bg flex flex-col pt-safe md:pt-0">
        {showSidebar && <Sidebar />}
        <div className={`flex-1 ${showSidebar ? "md:pl-[17.5rem]" : ""}`}>
          <div className={showBottomBar ? "pb-24 md:pb-8" : ""}>{children}</div>
        </div>
        {showBottomBar && <BottomBar mistakeCount={mistakeCount} />}
      </div>
    </ShellCtx.Provider>
  );
}

export function useShell() {
  return useContext(ShellCtx);
}
