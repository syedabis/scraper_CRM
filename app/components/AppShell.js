"use client";

import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function AppShell({ title, search, ownerSelect, sidebarExtra, children }) {
  return (
    <div className="min-h-screen bg-background text-on-background flex">
      <Sidebar>{sidebarExtra}</Sidebar>
      <TopNav title={title} search={search} ownerSelect={ownerSelect} />
      <main className="mt-16 ml-0 md:ml-[280px] p-6 lg:p-8 w-full max-w-[1440px] mx-auto overflow-y-auto themed-scrollbar">
        {children}
      </main>
    </div>
  );
}
