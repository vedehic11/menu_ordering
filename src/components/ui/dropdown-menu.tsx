"use client";

import * as React from "react";

// Minimal DropdownMenu stub
function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

function DropdownMenuContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`z-50 min-w-[8rem] rounded-lg border border-input bg-background p-1 shadow-md ${className}`}>
      {children}
    </div>
  );
}

function DropdownMenuItem({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm hover:bg-muted ${className}`}
    >
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className = "" }: { className?: string }) {
  return <div className={`my-1 h-px bg-border ${className}`} />;
}

function DropdownMenuLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-2.5 py-1.5 text-xs font-semibold text-muted-foreground ${className}`}>{children}</div>;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel };
