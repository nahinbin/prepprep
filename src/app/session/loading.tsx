import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function SessionLoading() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8 pt-safe pb-safe flex items-center justify-center">
      <Card className="w-full max-w-3xl p-5 md:p-8 rounded-3xl border-2 border-white/5 relative overflow-hidden space-y-6">
        {/* Top Progress Bar Skeleton */}
        <Skeleton className="h-1.5 w-full rounded-none -mx-8 -mt-8 mb-6" />

        {/* Top Controls Skeleton */}
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="w-20 h-8 rounded-xl" />
          <Skeleton className="w-28 h-8 rounded-xl" />
          <Skeleton className="w-20 h-8 rounded-xl" />
        </div>

        {/* Question Skeleton */}
        <div className="space-y-3 py-2">
          <Skeleton className="w-full h-8 rounded-xl" />
          <Skeleton className="w-3/4 h-6 rounded-xl" />
        </div>

        {/* Options Skeleton (1-2 options preview) */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          <Skeleton className="w-full h-14 rounded-2xl" />
          <Skeleton className="w-full h-14 rounded-2xl" />
        </div>
      </Card>
    </div>
  );
}
