import { AppShell } from "@/components/NavMenu";
import { AppHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function RootLoading() {
  return (
    <AppShell>
      <div className="w-full flex flex-col px-4 pt-4 pb-8 md:px-8 md:pt-6 max-w-4xl mx-auto space-y-6">
        {/* Minimal Header Skeleton */}
        <AppHeaderSkeleton />

        {/* 1-2 Minimal Card Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-[1.35rem]" />
          <Skeleton className="h-24 rounded-[1.35rem]" />
          <Skeleton className="h-24 rounded-[1.35rem] hidden sm:block" />
        </div>

        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
    </AppShell>
  );
}
