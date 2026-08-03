"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function AppShell({ title, search, sidebarExtra, sidebarFooter, hideTopNav, collapsibleSidebar, children }) {
  // Only relevant when collapsibleSidebar is set (Dashboard only) — starts
  // closed by default there; every other page keeps the sidebar always on.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isSidebarVisible = !collapsibleSidebar || sidebarOpen;

 return (
    <div className="relative min-h-screen bg-background text-on-background flex">
      {/* 1. Background Layer Container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="ambient-bg" />
      </div>

      {/* 2. Functional Layout Components (Now cleanly aligned by the flex container) */}
      <Sidebar footerExtra={sidebarFooter} open={isSidebarVisible}>{sidebarExtra}</Sidebar>

      {collapsibleSidebar && (
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-30 w-6 h-16 items-center justify-center bg-[#12162a]/90 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 rounded-r-lg ${
            sidebarOpen ? 'left-[280px]' : 'left-0'
          }`}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span className="material-symbols-outlined text-[16px] text-white">
            {sidebarOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      )}

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {!hideTopNav && <TopNav title={title} search={search} />}
        <main
          className={`overflow-y-auto overflow-x-hidden themed-scrollbar transition-all duration-300 ${hideTopNav ? '' : 'mt-16'} ${
            isSidebarVisible ? 'pl-0 md:pl-[280px]' : 'pl-0'
          }`}
        >
          <div className="max-w-[1440px] mx-auto p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}