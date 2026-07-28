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
      {/* 1. Background Layer Container (Keeps everything absolutely positioned together out of the flex flow) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="ambient-bg" />
        
        {/* Uncommented and safely isolated glows */}
        <div className="pulse-glow absolute" style={{ top: '18%', right: '10%', width: '420px', height: '420px' }} />
        <div className="pulse-glow absolute" style={{ bottom: '8%', left: '22%', width: '360px', height: '360px', animationDelay: '4.5s' }} />
        
        {/* The Wave Wrapper made absolute so it sits strictly in the background */}
        <div className="header-wave absolute top-0 left-0 w-full h-[250px]">
          <svg viewBox="0 0 1200 250" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Deep blurred base glow */}
            <path d="M 0,160 Q 300,180 500,100 T 900,40 T 1200,80" fill="none" stroke="rgba(147,51,234,0.4)" strokeWidth="15" style={{ filter: 'blur(15px)' }} />
            {/* Mid-level bright blur */}
            <path d="M 0,160 Q 300,180 500,100 T 900,40 T 1200,80" fill="none" stroke="rgba(192,132,252,0.6)" strokeWidth="6" style={{ filter: 'blur(6px)' }} />
            {/* Sharp central light core */}
            <path d="M 0,160 Q 300,180 500,100 T 900,40 T 1200,80" fill="none" stroke="rgba(243,232,255,0.9)" strokeWidth="1" />
            {/* Secondary intersecting blue wave */}
            <path d="M 100,130 Q 350,200 650,80 T 1100,20 T 1200,30" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="8" style={{ filter: 'blur(8px)' }} />
            <path d="M 100,130 Q 350,200 650,80 T 1100,20 T 1200,30" fill="none" stroke="rgba(147,197,253,0.6)" strokeWidth="1" />
          </svg>
        </div>
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

      <div className="flex-1 flex flex-col relative z-10">
        {!hideTopNav && <TopNav title={title} search={search} />}
        <main
          className={`w-full max-w-[1440px] mx-auto p-6 lg:p-8 overflow-y-auto themed-scrollbar transition-all duration-300 ${hideTopNav ? '' : 'mt-16'} ${
            isSidebarVisible ? 'ml-0 md:ml-[280px]' : 'ml-0'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}