"use client";

import * as React from "react";

function Select({
  children,
  onValueChange,
  value,
  defaultValue,
}: {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  value?: string;
  defaultValue?: string;
}) {
  return <>{children}</>;
}

function SelectTrigger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button
      className={`flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 py-1 text-sm ${className}`}
    >
      {children}
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-muted-foreground">{placeholder}</span>;
}

function SelectContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-1 rounded-lg border border-input bg-background shadow-md ${className}`}>
      {children}
    </div>
  );
}

function SelectItem({
  children,
  value,
  className = "",
}: {
  children: React.ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <div className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-muted ${className}`} data-value={value}>
      {children}
    </div>
  );
}

function SelectGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function SelectLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-3 py-1 text-xs font-semibold text-muted-foreground ${className}`}>{children}</div>;
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel };
