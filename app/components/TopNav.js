"use client";

import { UserButton } from "@clerk/nextjs";

export default function TopNav({ title, search }) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-[280px] h-16 z-30 flex justify-between items-center px-8 pointer-events-none transition-all duration-300">
      <div className="flex items-center gap-4 w-1/3">
        <h2 className="text-headline-sm font-bold text-white truncate drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">{title}</h2>
      </div>
      <div className="flex items-center justify-end gap-4 w-2/3 pointer-events-auto">
        {search}
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
