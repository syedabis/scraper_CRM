'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function UserButton({ appearance = {} }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/sign-in');
    router.refresh();
  };

  const initial = user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs hover:bg-emerald-500/30 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
        title={user?.email || 'User Account'}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-outline-variant shadow-2xl py-2 z-50 text-on-surface animate-in fade-in zoom-in-95 duration-100">
          <div className="px-4 py-2 border-b border-outline-variant">
            <p className="text-xs font-semibold text-on-surface truncate">{user?.name || 'Sales Agent'}</p>
            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{user?.email || 'Logged in'}</p>
          </div>
          <div className="px-2 pt-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-xs rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
