"use client";

import { UserButton } from "@clerk/nextjs";

export default function TopNav({ title, search }) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-[280px] h-16 z-30 bg-surface border-b border-outline-variant flex justify-between items-center px-8 transition-all duration-300">
      <div className="flex items-center gap-4 w-1/3">
        <h2 className="text-headline-md font-bold text-on-surface truncate">{title}</h2>
      </div>
      <div className="flex items-center justify-end gap-4 w-2/3">
        {search}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
