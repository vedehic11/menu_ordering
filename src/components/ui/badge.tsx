import * as React from "react";

function Badge({
  className = "",
  variant = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-red-100 text-red-700",
    outline: "border border-current",
  };
  return (
    <span className={`${base} ${variants[variant] ?? ""} ${className}`} {...props}>
      {children}
    </span>
  );
}

export { Badge };
