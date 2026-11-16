import React from "react";

// Admin layout: provides left-margin offset for the sidebar on desktop
// and top/bottom padding for mobile top bar + bottom tab bar
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0F0D0B] min-h-screen">
      {/*
        md: shift content right by sidebar width (w-56 = 224px)
        mobile: pad top for top bar (h-14 = 56px) + bottom for tab bar (~60px)
      */}
      <div className="md:ml-56 pt-14 md:pt-0 pb-16 md:pb-0 min-h-screen">
        {children}
      </div>
    </div>
  );
}

