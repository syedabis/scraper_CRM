"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" },
  { href: "/calling", label: "Calling", icon: "call" },
  { href: "/data-entry", label: "Data Entry", icon: "assignment" },
  { href: "/send-invoice", label: "Send Invoice", icon: "receipt_long" },
  { href: "/admin", label: "Admin Panel", icon: "admin_panel_settings" },
];

export default function Sidebar({ children, footerExtra, open = true }) {
  const pathname = usePathname();

  return (
    <nav
      className={`w-[280px] h-screen fixed left-0 top-0 sidebar-glass z-20 hidden md:flex flex-col gap-2 p-4 transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-4 px-1 h-16 w-full flex items-center justify-start">
        <img
          src="/logo.png"
          alt="CognosX Sales Portal"
          className="h-12 w-auto max-w-full object-contain object-left"
        />
      </div>

      <Link
        href="/data-entry"
        className="w-full bg-[#183a26] text-emerald-300 border border-emerald-500/30 py-3 px-4 rounded-lg text-label-md mb-4 hover:bg-[#204d33] hover:text-white transition-all flex items-center justify-start gap-3 font-medium cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">
          add
        </span>
        <span>Add New Lead</span>
      </Link>

      <div className="flex-1 overflow-y-auto themed-scrollbar -mr-2 pr-2">
        {children ?? (
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${
                      active
                        ? "nav-item-active"
                        : "text-muted hover:text-gray-200 hover:bg-white/5 rounded-r-lg border-l-[3px] border-transparent"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="text-label-md">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {footerExtra}

      <div className="mt-auto pt-2">
        <button className="w-full glass-card p-2.5 flex items-center justify-between hover:bg-white/5 transition-colors text-muted text-label-sm font-medium cursor-pointer">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-brand-green">headset_mic</span>
            Help &amp; Support
          </span>
          <span className="material-symbols-outlined text-[16px] text-dim">chevron_right</span>
        </button>
      </div>
    </nav>
  );
}
