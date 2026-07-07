"use client";

import { UserButton } from "@clerk/nextjs";

export default function TopNav({ title, search, ownerSelect }) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-[280px] h-16 z-30 bg-surface border-b border-outline-variant flex justify-between items-center px-8 transition-all duration-300">
      <div className="flex items-center gap-4 w-1/3">{search}</div>
      <div className="flex items-center justify-center w-1/3">
        <h2 className="text-headline-md font-bold text-on-surface truncate">{title}</h2>
      </div>
      <div className="flex items-center justify-end gap-4 w-1/3">
        {ownerSelect}
        <button className="text-on-surface-variant hover:bg-surface-container-high rounded-full p-2 transition-all duration-200">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
