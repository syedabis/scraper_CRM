"use client";

import Link from "next/link";
import UserButton from "./UserButton";
import ThemeToggle from "./ThemeToggle";

export default function TopNav({ title, search }) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-[280px] h-16 z-30 flex justify-between items-center px-6 md:px-8 pointer-events-none transition-all duration-300">
      <div className="flex items-center gap-3 w-1/3 min-w-0 pointer-events-auto">
        <Link
          href="/"
          title="Go to Homepage / Dashboard"
          className="header-btn px-2.5 py-1.5 rounded-lg text-muted hover:text-on-surface flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[17px] text-brand-green">home</span>
          <span className="hidden sm:inline">Home</span>
        </Link>
        <span className="text-muted/40 text-xs hidden sm:inline">/</span>
        <h2 className="text-headline-sm font-bold text-on-surface truncate">
          {title}
        </h2>
      </div>
      <div className="flex items-center justify-end gap-3 w-2/3 pointer-events-auto">
        {search}
        <ThemeToggle />
        <div className="header-btn w-10 h-10 flex items-center justify-center p-0.5 cursor-pointer">
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-7 h-7"
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
