import * as React from "react";

export function Card({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`glass rounded-[var(--radius)] p-6 text-card-foreground shadow-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
