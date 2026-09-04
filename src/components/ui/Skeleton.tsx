export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`}
      {...props}
    />
  );
}

export function AppHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-2xl" />
        <div className="space-y-1.5 hidden sm:block">
          <Skeleton className="w-14 h-3 rounded-md" />
          <Skeleton className="w-24 h-4 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-20 h-9 rounded-2xl" />
        <Skeleton className="w-24 h-9 rounded-2xl" />
        <Skeleton className="w-10 h-10 rounded-2xl md:hidden" />
      </div>
    </div>
  );
}
