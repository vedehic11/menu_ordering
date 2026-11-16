"use client";

import * as React from "react";

function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  className = "",
}: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const active = value !== undefined ? value : internalValue;
  const setActive = (v: string) => {
    setInternalValue(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

const TabsContext = React.createContext<{ active: string; setActive: (v: string) => void }>({
  active: "",
  setActive: () => {},
});

function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex gap-1 rounded-lg bg-muted p-1 ${className}`}>{children}</div>
  );
}

function TabsTrigger({ children, value, className = "" }: { children: React.ReactNode; value: string; className?: string }) {
  const { active, setActive } = React.useContext(TabsContext);
  return (
    <button
      onClick={() => setActive(value)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
        active === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function TabsContent({ children, value, className = "" }: { children: React.ReactNode; value: string; className?: string }) {
  const { active } = React.useContext(TabsContext);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
