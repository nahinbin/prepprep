import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, error, ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-1.5 w-full">
        <input
          type={type}
          className={`flex h-11 w-full rounded-[var(--radius)] border border-border bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? "border-danger focus-visible:ring-danger" : ""
          } ${className}`}
          ref={ref}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
