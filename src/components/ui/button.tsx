import * as React from "react";

function Button({
  className = "",
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-muted",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-muted hover:text-foreground",
    destructive: "bg-red-100 text-red-700 hover:bg-red-200",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes: Record<string, string> = {
    default: "h-8 px-3 py-1.5 text-sm",
    xs: "h-6 px-2 text-xs",
    sm: "h-7 px-2.5 text-sm",
    lg: "h-10 px-4 text-base",
    icon: "h-8 w-8",
  };
  return (
    <button
      className={`${base} ${variants[variant] ?? ""} ${sizes[size] ?? ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button };
