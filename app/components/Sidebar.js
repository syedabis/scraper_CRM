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

export default function Sidebar({ children, footerExtra }) {
  const pathname = usePathname();

  return (
    <nav className="w-[280px] h-screen fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant shadow-sm z-20 hidden md:flex flex-col gap-2 p-4">
      <div className="mb-6">
        <h1 className="text-headline-md font-bold text-primary mb-1">Cognos Sales CRM</h1>
        <p className="text-body-md text-on-surface-variant">High-Velocity Sales</p>
      </div>

      <Link
        href="/data-entry"
        className="w-full bg-primary text-on-primary py-2 px-4 rounded-lg text-label-md mb-6 hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
        Add New Lead
      </Link>

      <div className="flex-1 overflow-y-auto themed-scrollbar">
        {children ?? (
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-all duration-200 ${
                      active
                        ? "bg-secondary-container text-on-secondary-container border-l-4 border-secondary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span className="text-label-md">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {footerExtra}

      <div className="mt-auto border-t border-outline-variant pt-4">
        <ul className="space-y-1">
          <li>
            <a
              className="flex items-center gap-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg px-4 py-2 transition-all duration-200"
              href="#"
            >
              <span className="material-symbols-outlined">help</span>
              <span className="text-label-md">Support</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
