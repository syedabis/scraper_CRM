"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" },
  { href: "/calling", label: "Calling", icon: "call" },
  { href: "/data-entry", label: "Data Entry", icon: "assignment" },
  { href: "/agent-tracking", label: "Agent Tracking", icon: "badge" },
];

export default function Sidebar({ children, footerExtra, open = true }) {
  const pathname = usePathname();

  return (
    <nav
      className={`w-[280px] h-screen fixed left-0 top-0 sidebar-glass z-20 hidden md:flex flex-col gap-2 p-4 transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <Link
        href="/"
        title="Go to Dashboard"
        className="mb-2 px-1 h-14 w-full flex items-center justify-start cursor-pointer hover:opacity-85 transition-opacity shrink-0"
      >
        <Logo
          className="h-11 w-auto max-w-full object-contain object-left"
          alt="CognosX Sales Portal"
        />
      </Link>

      <Link
        href="/data-entry"
        className="sidebar-add-lead-btn w-full bg-[#183a26] text-emerald-300 border border-emerald-500/30 py-2.5 px-3.5 rounded-lg text-xs mb-2 hover:bg-[#204d33] hover:text-white transition-all flex items-center justify-start gap-2.5 font-semibold cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">
          add
        </span>
        <span>Add New Lead</span>
      </Link>

      <div className="flex-1 overflow-y-auto themed-scrollbar -mr-2 pr-2 flex flex-col gap-3">
        <div>
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 px-3">
            Menu
          </div>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold transition-colors rounded-lg ${
                      active
                        ? "nav-item-active font-bold"
                        : "text-muted hover:text-on-surface hover:bg-white/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {children && (
          <div className="pt-2 border-t border-outline-variant/60">
            {children}
          </div>
        )}
      </div>

      {footerExtra}

      <div className="mt-auto pt-2 shrink-0">
        <button className="w-full glass-card p-2 flex items-center justify-between hover:bg-white/5 transition-colors text-muted text-xs font-medium cursor-pointer">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-brand-green">headset_mic</span>
            Help &amp; Support
          </span>
          <span className="material-symbols-outlined text-[14px] text-dim">chevron_right</span>
        </button>
      </div>
    </nav>
  );
}
