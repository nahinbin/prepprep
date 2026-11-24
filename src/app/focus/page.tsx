"use client";

import { useState } from "react";
import { AppShell } from "@/components/NavMenu";
import { FocusTimerModal } from "@/components/routine/FocusTimerModal";
import { Flame, Play, Clock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FocusPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <AppShell showBottomBar={false}>
      <FocusTimerModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          router.push("/routine");
        }}
        initialTitle="Deep Study Focus"
        defaultDurationMinutes={25}
      />
    </AppShell>
  );
}
